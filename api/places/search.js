export default async function handler(req, res) {

    /* =====================================================
       CORS
    ====================================================== */

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept"
    );


    /* =====================================================
       PREFLIGHT
    ====================================================== */

    if (req.method === "OPTIONS") {

        return res.status(204).end();

    }


    /* =====================================================
       METHOD
    ====================================================== */

    if (req.method !== "GET") {

        return res.status(405).json({

            success: false,

            error:
                "Method not allowed."

        });

    }


    /* =====================================================
       GOOGLE API KEY
    ====================================================== */

    const GOOGLE_API_KEY =
        process.env.GOOGLE_PLACES_API_KEY;


    if (!GOOGLE_API_KEY) {

        console.error(
            "BOKKARA PLACES ERROR: GOOGLE_PLACES_API_KEY is missing."
        );


        return res.status(500).json({

            success: false,

            error:
                "Google Places API key is not configured.",

            places: []

        });

    }


    /* =====================================================
       PARAMETERS
    ====================================================== */

    const query =
        typeof req.query.query === "string"
            ? req.query.query.trim()
            : "";


    const placeId =
        typeof req.query.placeId === "string"
            ? req.query.placeId.trim()
            : "";


    const category =
        typeof req.query.category === "string"
            ? req.query.category.trim().toLowerCase()
            : "food";


    const latitude =
        req.query.latitude !== undefined
            ? Number(req.query.latitude)
            : null;


    const longitude =
        req.query.longitude !== undefined
            ? Number(req.query.longitude)
            : null;


    const accuracy =
        req.query.accuracy !== undefined
            ? Number(req.query.accuracy)
            : null;


    const radius =
        req.query.radius !== undefined
            ? Number(req.query.radius)
            : 10000;


    const pageToken =
        typeof req.query.pageToken === "string"
            ? req.query.pageToken.trim()
            : "";


    /* =====================================================
       LOCATION VALIDATION
    ====================================================== */

    const hasLocation =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;


    /* =====================================================
       SAFE RADIUS
    ====================================================== */

    const safeRadius =
        Number.isFinite(radius)
            ? Math.min(
                Math.max(radius, 1),
                50000
            )
            : 10000;


    /* =====================================================
       LOGGING
    ====================================================== */

    console.log(
        "================================================="
    );

    console.log(
        "BOKKARA PLACES SEARCH REQUEST"
    );

    console.log(
        "query:",
        query
    );

    console.log(
        "placeId:",
        placeId
    );

    console.log(
        "category:",
        category
    );

    console.log(
        "latitude:",
        latitude
    );

    console.log(
        "longitude:",
        longitude
    );

    console.log(
        "radius:",
        safeRadius
    );

    console.log(
        "pageToken:",
        pageToken
    );

    console.log(
        "================================================="
    );


    /* =====================================================
       GOOGLE CATEGORY TYPES
    ====================================================== */

    const CATEGORY_TYPES = {

        food: [

            "restaurant",
            "cafe",
            "bakery",
            "bar",
            "meal_takeaway"

        ],


        things: [

            "tourist_attraction",
            "museum",
            "park",
            "movie_theater",
            "amusement_park",
            "art_gallery",
            "library",
            "night_club",
            "performing_arts_theater",
            "zoo",
            "aquarium",
            "bowling_alley",
            "gym"

        ],


        shopping: [

            "shopping_mall",
            "department_store",
            "clothing_store",
            "supermarket",
            "convenience_store",
            "grocery_store",
            "shoe_store",
            "jewelry_store",
            "book_store",
            "electronics_store",
            "furniture_store",
            "hardware_store",
            "home_goods_store",
            "liquor_store",
            "pet_store",
            "sporting_goods_store"

        ],


        services: [

            "bank",
            "pharmacy",
            "laundry",
            "car_repair",
            "beauty_salon",
            "hair_care",
            "dentist",
            "doctor",
            "hospital",
            "insurance_agency",
            "real_estate_agency",
            "lawyer",
            "accounting",
            "travel_agency",
            "post_office",
            "car_rental"

        ]

    };


    const selectedTypes =
        CATEGORY_TYPES[category] ||
        CATEGORY_TYPES.food;


    /* =====================================================
       GOOGLE ENDPOINTS
    ====================================================== */

    const TEXT_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchText";


    const NEARBY_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchNearby";


    const PLACE_DETAILS_BASE_URL =
        "https://places.googleapis.com/v1/places/";


    /* =====================================================
       IMPORTANT
       
       SEARCH + DETAILS BOTH REQUEST EVERYTHING.

       Google supports "*" for the field mask.
       
       Search:
       places.*
       
       Details:
       *
    ====================================================== */

    const SEARCH_FIELD_MASK =
        "places.*," +
        "nextPageToken," +
        "routingSummaries," +
        "contextualContents";


    const DETAILS_FIELD_MASK =
        "*";


    /* =====================================================
       GOOGLE SEARCH REQUEST
    ====================================================== */

    async function googleSearchRequest(
        url,
        body
    ) {

        console.log(
            "BOKKARA GOOGLE SEARCH:",
            url
        );


        const response =
            await fetch(
                url,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        "X-Goog-Api-Key":
                            GOOGLE_API_KEY,

                        "X-Goog-FieldMask":
                            SEARCH_FIELD_MASK

                    },

                    body:
                        JSON.stringify(
                            body
                        )

                }
            );


        const text =
            await response.text();


        let data = {};


        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        }

        catch (error) {

            console.error(
                "BOKKARA GOOGLE SEARCH INVALID JSON:",
                text
            );


            throw new Error(
                "Google Places returned invalid JSON."
            );

        }


        console.log(
            "BOKKARA GOOGLE SEARCH STATUS:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "BOKKARA GOOGLE SEARCH ERROR:",
                data
            );


            throw new Error(

                data?.error?.message ||

                "Google Places search failed."

            );

        }


        return data;

    }


    /* =====================================================
       GOOGLE PLACE DETAILS
       
       THIS IS THE IMPORTANT PART.
       
       Every search result is sent back to Google Place
       Details so we get the complete place object.
    ====================================================== */

    async function getPlaceDetails(
        id
    ) {

        if (
            typeof id !== "string" ||
            !id.trim()
        ) {

            return null;

        }


        const cleanId =
            id
                .trim()
                .replace(
                    /^places\//,
                    ""
                );


        const url =
            PLACE_DETAILS_BASE_URL +
            encodeURIComponent(
                cleanId
            );


        console.log(
            "BOKKARA FULL PLACE DETAILS:",
            cleanId
        );


        const response =
            await fetch(
                url,
                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json",

                        "X-Goog-Api-Key":
                            GOOGLE_API_KEY,

                        "X-Goog-FieldMask":
                            DETAILS_FIELD_MASK

                    }

                }
            );


        const text =
            await response.text();


        let data = {};


        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        }

        catch (error) {

            console.error(
                "BOKKARA DETAILS INVALID JSON:",
                text
            );


            return null;

        }


        console.log(
            "BOKKARA DETAILS STATUS:",
            response.status,
            cleanId
        );


        if (!response.ok) {

            console.error(
                "BOKKARA DETAILS ERROR:",
                data
            );


            return null;

        }


        return data;

    }


    /* =====================================================
       EXTRACT PLACE ID
    ====================================================== */

    function extractPlaceId(
        resourceName
    ) {

        if (
            typeof resourceName !== "string"
        ) {

            return "";

        }


        if (
            resourceName.startsWith(
                "places/"
            )
        ) {

            return resourceName.substring(
                "places/".length
            );

        }


        return resourceName;

    }


    /* =====================================================
       PHOTO URL
       
       IMPORTANT:
       
       Google photo resource names are NOT normal image
       URLs.
       
       They must be passed through Place Photo Media.
    ====================================================== */

    function createPhotoUrl(
        photoName,
        width = 1600,
        height = 1600
    ) {

        if (
            typeof photoName !== "string" ||
            !photoName.trim()
        ) {

            return "";

        }


        return (

            "https://api-places-search-js.vercel.app/api/places/photo" +

            "?name=" +

            encodeURIComponent(
                photoName
            ) +

            "&width=" +

            encodeURIComponent(
                width
            ) +

            "&height=" +

            encodeURIComponent(
                height
            )

        );

    }


    /* =====================================================
       ENRICH PHOTOS
    ====================================================== */

    function enrichPhotos(
        photos
    ) {

        if (
            !Array.isArray(photos)
        ) {

            return [];

        }


        return photos

            .map(
                (
                    photo,
                    index
                ) => {

                    if (!photo) {

                        return null;

                    }


                    const photoName =
                        typeof photo.name === "string"
                            ? photo.name
                            : "";


                    return {

                        /* =================================
                           ORIGINAL GOOGLE PHOTO DATA
                        ================================= */

                        ...photo,


                        /* =================================
                           BOKKARA CONVENIENCE FIELDS
                        ================================= */

                        index,


                        photoUrl:
                            createPhotoUrl(
                                photoName,
                                1600,
                                1600
                            ),


                        thumbnailUrl:
                            createPhotoUrl(
                                photoName,
                                800,
                                800
                            ),


                        largeUrl:
                            createPhotoUrl(
                                photoName,
                                2400,
                                2400
                            )

                    };

                }
            )

            .filter(Boolean);

    }


    /* =====================================================
       ENRICH REVIEWS
       
       DO NOT REMOVE ANY GOOGLE REVIEW DATA.
    ====================================================== */

    function enrichReviews(
        reviews
    ) {

        if (
            !Array.isArray(reviews)
        ) {

            return [];

        }


        return reviews

            .map(
                (
                    review,
                    index
                ) => {

                    if (!review) {

                        return null;

                    }


                    return {

                        ...review,

                        index,

                        author:
                            review.authorAttribution ||
                            null,

                        authorName:
                            review.authorAttribution?.displayName ||
                            "",

                        authorPhoto:
                            review.authorAttribution?.photoUri ||
                            "",

                        authorUri:
                            review.authorAttribution?.uri ||
                            "",

                        reviewText:
                            review.text?.text ||
                            "",

                        reviewLanguage:
                            review.text?.languageCode ||
                            null,

                        originalText:
                            review.originalText?.text ||
                            "",

                        originalLanguage:
                            review.originalText?.languageCode ||
                            null,

                        publishTime:
                            review.publishTime ||
                            null,

                        relativePublishTimeDescription:
                            review.relativePublishTimeDescription ||
                            "",

                        rating:
                            review.rating ??
                            null,

                        googleMapsUri:
                            review.googleMapsUri ||
                            null

                    };

                }
            )

            .filter(Boolean);

    }


    /* =====================================================
       NORMALIZE PLACE
       
       CRITICAL:
       
       The `google` object contains the FULL Google object.
       
       We do not throw anything away.
    ====================================================== */

    function normalizeGooglePlace(
        place
    ) {

        if (!place) {

            return null;

        }


        const resourceName =
            typeof place.name === "string"
                ? place.name
                : "";


        const extractedPlaceId =
            place.id ||
            extractPlaceId(
                resourceName
            ) ||
            "";


        const photos =
            enrichPhotos(
                place.photos
            );


        const reviews =
            enrichReviews(
                place.reviews
            );


        const location =
            place.location ||
            {};


        return {

            /* =============================================
               BOKKARA STANDARD FIELDS
            ============================================== */

            placeId:
                extractedPlaceId,


            name:
                place.displayName?.text ||
                "",


            displayName:
                place.displayName ||
                null,


            address:
                place.formattedAddress ||
                "",


            shortAddress:
                place.shortFormattedAddress ||
                "",


            latitude:
                Number.isFinite(
                    Number(
                        location.latitude
                    )
                )
                    ? Number(
                        location.latitude
                    )
                    : null,


            longitude:
                Number.isFinite(
                    Number(
                        location.longitude
                    )
                )
                    ? Number(
                        location.longitude
                    )
                    : null,


            rating:
                place.rating ??
                null,


            userRatingCount:
                place.userRatingCount ??
                null,


            reviews,


            photos,


            primaryType:
                place.primaryType ||
                null,


            primaryTypeDisplayName:
                place.primaryTypeDisplayName ||
                null,


            types:
                Array.isArray(
                    place.types
                )
                    ? place.types
                    : [],


            businessStatus:
                place.businessStatus ||
                null,


            phone:
                place.nationalPhoneNumber ||
                null,


            internationalPhone:
                place.internationalPhoneNumber ||
                null,


            website:
                place.websiteUri ||
                null,


            googleMapsUrl:
                place.googleMapsUri ||
                null,


            priceLevel:
                place.priceLevel ??
                null,


            priceRange:
                place.priceRange ??
                null,


            openNow:
                place.currentOpeningHours?.openNow ??
                null,


            openingHours:
                place.regularOpeningHours ||
                null,


            currentOpeningHours:
                place.currentOpeningHours ||
                null,


            /* =============================================
               EVERYTHING ELSE GOOGLE RETURNS
               
               This is intentionally preserved.
            ============================================== */

            google: {

                ...place,

                photos,

                reviews

            }

        };

    }


    /* =====================================================
       DEDUPLICATE
    ====================================================== */

    function deduplicatePlaces(
        places
    ) {

        const map =
            new Map();


        for (
            const place of places
        ) {

            if (!place) {

                continue;

            }


            const key =
                place.placeId ||
                (
                    place.name +
                    "|" +
                    place.address
                );


            if (
                !map.has(key)
            ) {

                map.set(
                    key,
                    place
                );

            }

        }


        return Array.from(
            map.values()
        );

    }


    /* =====================================================
       FULL ENRICHMENT
       
       SEARCH RESULTS -> PLACE DETAILS
       
       This guarantees the frontend gets the full Google
       Place object instead of relying only on search data.
    ====================================================== */

    async function enrichPlacesWithDetails(
        searchPlaces
    ) {

        if (
            !Array.isArray(searchPlaces) ||
            searchPlaces.length === 0
        ) {

            return [];

        }


        console.log(
            "BOKKARA ENRICHING",
            searchPlaces.length,
            "PLACES WITH FULL DETAILS"
        );


        const results =
            await Promise.all(

                searchPlaces.map(
                    async (
                        searchPlace,
                        index
                    ) => {

                        try {

                            const id =
                                searchPlace?.id ||
                                extractPlaceId(
                                    searchPlace?.name
                                );


                            if (!id) {

                                console.warn(
                                    "BOKKARA PLACE HAS NO ID:",
                                    index
                                );


                                return normalizeGooglePlace(
                                    searchPlace
                                );

                            }


                            const details =
                                await getPlaceDetails(
                                    id
                                );


                            if (details) {

                                console.log(
                                    "BOKKARA FULL DETAILS SUCCESS:",
                                    id,
                                    "photos:",
                                    Array.isArray(
                                        details.photos
                                    )
                                        ? details.photos.length
                                        : 0,
                                    "reviews:",
                                    Array.isArray(
                                        details.reviews
                                    )
                                        ? details.reviews.length
                                        : 0
                                );


                                return normalizeGooglePlace(
                                    details
                                );

                            }


                            /* =================================
                               FALLBACK
                            ================================= */

                            return normalizeGooglePlace(
                                searchPlace
                            );

                        }

                        catch (error) {

                            console.error(
                                "BOKKARA DETAIL ENRICHMENT FAILED:",
                                index,
                                error
                            );


                            return normalizeGooglePlace(
                                searchPlace
                            );

                        }

                    }
                )

            );


        return results

            .filter(Boolean);

    }


    /* =====================================================
       PLACE DETAILS DIRECT REQUEST
       
       /api/places/search?placeId=ChIJ...
    ====================================================== */

    if (placeId) {

        try {

            const googlePlace =
                await getPlaceDetails(
                    placeId
                );


            if (!googlePlace) {

                return res.status(404).json({

                    success:
                        false,

                    type:
                        "place_details",

                    error:
                        "Google Place was not found.",

                    place:
                        null

                });

            }


            const place =
                normalizeGooglePlace(
                    googlePlace
                );


            return res.status(200).json({

                success:
                    true,

                type:
                    "place_details",

                placeId:
                    place.placeId,

                place,

                /* =========================================
                   COMPLETE ORIGINAL GOOGLE OBJECT
                ========================================== */

                google:
                    googlePlace

            });

        }

        catch (error) {

            console.error(
                "BOKKARA PLACE DETAILS ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                type:
                    "place_details",

                error:
                    "Google Places details request failed.",

                details:
                    error.message ||
                    "Unknown Google Places error.",

                place:
                    null

            });

        }

    }


    /* =====================================================
       TEXT SEARCH
    ====================================================== */

    if (query) {

        try {

            const body = {

                textQuery:
                    query,

                pageSize:
                    20

            };


            if (pageToken) {

                body.pageToken =
                    pageToken;

            }


            if (hasLocation) {

                body.locationBias = {

                    circle: {

                        center: {

                            latitude:
                                latitude,

                            longitude:
                                longitude

                        },

                        radius:
                            safeRadius

                    }

                };

            }


            /* =============================================
               SEARCH GOOGLE
            ============================================== */

            const googleData =
                await googleSearchRequest(
                    TEXT_SEARCH_URL,
                    body
                );


            const searchPlaces =
                Array.isArray(
                    googleData.places
                )
                    ? googleData.places
                    : [];


            console.log(
                "BOKKARA GOOGLE SEARCH RESULTS:",
                searchPlaces.length
            );


            /* =============================================
               NOW GET FULL DETAILS FOR EVERY PLACE
            ============================================== */

            const places =
                await enrichPlacesWithDetails(
                    searchPlaces
                );


            return res.status(200).json({

                success:
                    true,

                type:
                    "text_search",

                count:
                    places.length,

                category:
                    category,

                query:
                    query,

                location:
                    hasLocation
                        ? {

                            latitude:
                                latitude,

                            longitude:
                                longitude,

                            accuracy:
                                Number.isFinite(
                                    accuracy
                                )
                                    ? accuracy
                                    : null,

                            radius:
                                safeRadius

                        }
                        : null,


                nextPageToken:
                    googleData.nextPageToken ||
                    null,


                /* =========================================
                   FULL ENRICHED RESULTS
                ========================================== */

                places,


                /* =========================================
                   ORIGINAL SEARCH RESPONSE
                ========================================== */

                google:
                    googleData

            });

        }

        catch (error) {

            console.error(
                "BOKKARA TEXT SEARCH ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                type:
                    "text_search",

                error:
                    "Google Places search failed.",

                details:
                    error.message ||
                    "Unknown Google Places error.",

                places: []

            });

        }

    }


    /* =====================================================
       CATEGORY SEARCH REQUIRES LOCATION
    ====================================================== */

    if (!hasLocation) {

        return res.status(400).json({

            success:
                false,

            error:
                "Location is required for a category search.",

            code:
                "LOCATION_REQUIRED",

            category:
                category,

            places: []

        });

    }


    /* =====================================================
       CATEGORY SEARCH
    ====================================================== */

    const allSearchPlaces = [];


    const googleResponses = [];


    /* =====================================================
       GOOGLE NEARBY SEARCH
    ====================================================== */

    for (
        const type of selectedTypes
    ) {

        try {

            const body = {

                includedTypes: [

                    type

                ],

                maxResultCount:
                    20,

                rankPreference:
                    "POPULARITY",

                locationRestriction: {

                    circle: {

                        center: {

                            latitude:
                                latitude,

                            longitude:
                                longitude

                        },

                        radius:
                            safeRadius

                    }

                }

            };


            const googleData =
                await googleSearchRequest(
                    NEARBY_SEARCH_URL,
                    body
                );


            googleResponses.push({

                type,

                response:
                    googleData

            });


            const googlePlaces =
                Array.isArray(
                    googleData.places
                )
                    ? googleData.places
                    : [];


            for (
                const place of googlePlaces
            ) {

                if (place) {

                    allSearchPlaces.push(
                        place
                    );

                }

            }

        }

        catch (error) {

            console.error(

                "BOKKARA GOOGLE TYPE FAILED:",

                type,

                error.message

            );

        }

    }


    /* =====================================================
       DEDUPLICATE SEARCH RESULTS FIRST
    ====================================================== */

    const uniqueSearchPlaces =
        deduplicatePlaces(

            allSearchPlaces.map(
                normalizeGooglePlace
            )

        ).map(
            place => {

                return {

                    id:
                        place.placeId,

                    name:
                        "places/" +
                        place.placeId

                };

            }

        );


    /* =====================================================
       FULL DETAILS FOR EVERY PLACE
    ====================================================== */

    const places =
        await enrichPlacesWithDetails(
            uniqueSearchPlaces
        );


    /* =====================================================
       LIMIT
    ====================================================== */

    const limitedPlaces =
        places.slice(
            0,
            50
        );


    /* =====================================================
       RETURN
    ====================================================== */

    return res.status(200).json({

        success:
            true,

        type:
            "category_search",

        count:
            limitedPlaces.length,

        category:
            category,

        query:
            "",

        location: {

            latitude:
                latitude,

            longitude:
                longitude,

            accuracy:
                Number.isFinite(
                    accuracy
                )
                    ? accuracy
                    : null,

            radius:
                safeRadius

        },


        /* ================================================
           FULL PLACES
        ================================================ */

        places:
            limitedPlaces,


        /* ================================================
           ORIGINAL GOOGLE SEARCH RESPONSES
        ================================================ */

        google:
            googleResponses

    });

}
