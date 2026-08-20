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
            "BOKKARA ERROR: GOOGLE_PLACES_API_KEY is missing."
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
       LOCATION
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
        "BOKKARA PLACES SEARCH"
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
        "================================================="
    );


    /* =====================================================
       CATEGORY TYPES
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


    const DETAILS_BASE_URL =
        "https://places.googleapis.com/v1/places/";


    /* =====================================================
       FIELD MASKS
       
       IMPORTANT:
       
       DO NOT use the same mask for every operation.
       
       Text Search:
       places.* + nextPageToken
       
       Nearby Search:
       places.*
       
       Details:
       *
    ====================================================== */

    const TEXT_SEARCH_FIELD_MASK =
        "places.*,nextPageToken";


    const NEARBY_SEARCH_FIELD_MASK =
        "places.*";


    const DETAILS_FIELD_MASK =
        "*";


    /* =====================================================
       GOOGLE POST REQUEST
    ====================================================== */

    async function googlePost(
        url,
        body,
        fieldMask
    ) {

        console.log(
            "BOKKARA GOOGLE POST:",
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
                            fieldMask

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
                "BOKKARA GOOGLE INVALID JSON:",
                text
            );


            throw new Error(
                "Google Places returned invalid JSON."
            );

        }


        console.log(
            "BOKKARA GOOGLE STATUS:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "BOKKARA GOOGLE ERROR:",
                data
            );


            throw new Error(

                data?.error?.message ||

                "Google Places request failed."

            );

        }


        return data;

    }


    /* =====================================================
       GOOGLE PLACE DETAILS
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
            DETAILS_BASE_URL +
            encodeURIComponent(
                cleanId
            );


        console.log(
            "BOKKARA DETAILS REQUEST:",
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
            response.status
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
                7
            );

        }


        return resourceName;

    }


    /* =====================================================
       GET PLACE ID FROM GOOGLE OBJECT
    ====================================================== */

    function getPlaceId(
        place
    ) {

        if (!place) {

            return "";

        }


        if (
            typeof place.id === "string" &&
            place.id.trim()
        ) {

            return place.id.trim();

        }


        if (
            typeof place.name === "string"
        ) {

            return extractPlaceId(
                place.name
            );

        }


        return "";

    }


    /* =====================================================
       PHOTO PROXY URL
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

                        ...photo,

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
                                600,
                                600
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


                    const author =
                        review.authorAttribution ||
                        {};


                    return {

                        ...review,

                        index,

                        author:
                            review.authorAttribution ||
                            null,

                        authorName:
                            author.displayName ||
                            "",

                        authorPhoto:
                            author.photoUri ||
                            "",

                        authorUri:
                            author.uri ||
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
       NORMALIZE GOOGLE PLACE
       
       NOTHING IMPORTANT IS REMOVED.
    ====================================================== */

    function normalizePlace(
        place
    ) {

        if (!place) {

            return null;

        }


        const id =
            getPlaceId(
                place
            );


        const location =
            place.location ||
            {};


        const photos =
            enrichPhotos(
                place.photos
            );


        const reviews =
            enrichReviews(
                place.reviews
            );


        return {

            /* =============================================
               IDENTIFICATION
            ============================================== */

            placeId:
                id,

            id:
                id,


            resourceName:
                place.name ||
                "",


            /* =============================================
               BASIC INFORMATION
            ============================================== */

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


            /* =============================================
               LOCATION
            ============================================== */

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


            location:
                place.location ||
                null,


            /* =============================================
               RATINGS
            ============================================== */

            rating:
                place.rating ??
                null,

            userRatingCount:
                place.userRatingCount ??
                null,


            /* =============================================
               REVIEWS
            ============================================== */

            reviews,


            reviewCount:
                reviews.length,


            /* =============================================
               PHOTOS
            ============================================== */

            photos,


            photoCount:
                photos.length,


            /* =============================================
               TYPES
            ============================================== */

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


            /* =============================================
               BUSINESS
            ============================================== */

            businessStatus:
                place.businessStatus ||
                null,


            /* =============================================
               CONTACT
            ============================================== */

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


            /* =============================================
               PRICE
            ============================================== */

            priceLevel:
                place.priceLevel ??
                null,

            priceRange:
                place.priceRange ??
                null,


            /* =============================================
               HOURS
            ============================================== */

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
               EDITORIAL / SUMMARY
            ============================================== */

            editorialSummary:
                place.editorialSummary ||
                null,

            generativeSummary:
                place.generativeSummary ||
                null,


            /* =============================================
               EVERYTHING GOOGLE RETURNED
               
               This is the important part.
               
               The complete Google object stays available
               to the Shopify frontend.
            ============================================== */

            google: {

                ...place,

                photos,

                reviews

            }

        };

    }


    /* =====================================================
       ENRICH ONE SEARCH RESULT
    ====================================================== */

    async function enrichOnePlace(
        searchPlace
    ) {

        const id =
            getPlaceId(
                searchPlace
            );


        if (!id) {

            return normalizePlace(
                searchPlace
            );

        }


        try {

            const details =
                await getPlaceDetails(
                    id
                );


            if (details) {

                console.log(
                    "BOKKARA DETAILS LOADED:",
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


                return normalizePlace(
                    details
                );

            }

        }

        catch (error) {

            console.error(
                "BOKKARA DETAILS ENRICHMENT ERROR:",
                id,
                error.message
            );

        }


        /* =============================================
           NEVER LOSE THE SEARCH RESULT
        ============================================== */

        return normalizePlace(
            searchPlace
        );

    }


    /* =====================================================
       ENRICH ALL PLACES
       
       Uses a small concurrency limit so we don't hammer
       Google with dozens of simultaneous requests.
    ====================================================== */

    async function enrichPlaces(
        searchPlaces
    ) {

        const results = [];


        const concurrency =
            5;


        for (
            let i = 0;
            i < searchPlaces.length;
            i += concurrency
        ) {

            const batch =
                searchPlaces.slice(
                    i,
                    i + concurrency
                );


            const batchResults =
                await Promise.all(

                    batch.map(
                        enrichOnePlace
                    )

                );


            results.push(
                ...batchResults
            );

        }


        return results;

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
                    (
                        place.name ||
                        ""
                    )
                    +
                    "|" +
                    (
                        place.address ||
                        ""
                    )
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
       DIRECT PLACE DETAILS
       
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
                normalizePlace(
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
       
       Example:
       
       /api/places/search?query=restaurants+in+Port+of+Spain
    ====================================================== */

    if (query) {

        try {

            const body = {

                textQuery:
                    query,

                pageSize:
                    20

            };


            /* =============================================
               PAGE TOKEN
            ============================================== */

            if (pageToken) {

                body.pageToken =
                    pageToken;

            }


            /* =============================================
               LOCATION BIAS
            ============================================== */

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
               GOOGLE TEXT SEARCH
            ============================================== */

            const googleData =
                await googlePost(

                    TEXT_SEARCH_URL,

                    body,

                    TEXT_SEARCH_FIELD_MASK

                );


            const searchPlaces =
                Array.isArray(
                    googleData.places
                )
                    ? googleData.places
                    : [];


            console.log(
                "BOKKARA TEXT SEARCH FOUND:",
                searchPlaces.length
            );


            /* =============================================
               FULL DETAILS
            ============================================== */

            const enriched =
                await enrichPlaces(
                    searchPlaces
                );


            const places =
                deduplicatePlaces(
                    enriched
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


                places,


                /* =========================================
                   ORIGINAL GOOGLE SEARCH RESPONSE
                ========================================== */

                google:
                    googleData

            });

        }

        catch (error) {

            console.error(
                "================================================="
            );

            console.error(
                "BOKKARA TEXT SEARCH FAILED"
            );

            console.error(
                error
            );

            console.error(
                "================================================="
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
       CATEGORY SEARCH NEEDS LOCATION
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
       RUN NEARBY SEARCH FOR EACH TYPE
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
                await googlePost(

                    NEARBY_SEARCH_URL,

                    body,

                    NEARBY_SEARCH_FIELD_MASK

                );


            googleResponses.push({

                type,

                response:
                    googleData

            });


            const found =
                Array.isArray(
                    googleData.places
                )
                    ? googleData.places
                    : [];


            console.log(
                "BOKKARA NEARBY TYPE:",
                type,
                "FOUND:",
                found.length
            );


            allSearchPlaces.push(
                ...found
            );

        }

        catch (error) {

            console.error(

                "BOKKARA NEARBY SEARCH FAILED:",

                type,

                error.message

            );

        }

    }


    /* =====================================================
       DEDUPLICATE SEARCH RESULTS
       
       Do this BEFORE Details calls.
    ====================================================== */

    const searchMap =
        new Map();


    for (
        const searchPlace
        of allSearchPlaces
    ) {

        const id =
            getPlaceId(
                searchPlace
            );


        if (
            id &&
            !searchMap.has(id)
        ) {

            searchMap.set(
                id,
                searchPlace
            );

        }

    }


    const uniqueSearchPlaces =
        Array.from(
            searchMap.values()
        );


    console.log(
        "BOKKARA UNIQUE PLACES:",
        uniqueSearchPlaces.length
    );


    /* =====================================================
       FULL DETAILS
    ====================================================== */

    const enrichedPlaces =
        await enrichPlaces(
            uniqueSearchPlaces
        );


    /* =====================================================
       FINAL DEDUPLICATION
    ====================================================== */

    const places =
        deduplicatePlaces(
            enrichedPlaces
        )
        .slice(
            0,
            50
        );


    /* =====================================================
       RETURN CATEGORY RESULTS
    ====================================================== */

    return res.status(200).json({

        success:
            true,

        type:
            "category_search",

        count:
            places.length,

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


        places,


        /* ================================================
           ORIGINAL GOOGLE RESPONSES
        ================================================ */

        google:
            googleResponses

    });

}
