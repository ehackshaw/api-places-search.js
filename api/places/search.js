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
       RADIUS
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
        "BOKKARA PLACES REQUEST"
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
       GOOGLE FIELD MASK
       
       WE ARE REQUESTING EVERYTHING GOOGLE MAKES
       AVAILABLE FOR THE OPERATION.
       
       Google supports "*" as the field mask.
    ====================================================== */

    const FIELD_MASK = "*";


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
       GOOGLE REQUEST
    ====================================================== */

    async function googleRequest(
        url,
        body
    ) {

        console.log(
            "BOKKARA GOOGLE REQUEST:",
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
                            FIELD_MASK

                    },

                    body:
                        JSON.stringify(
                            body
                        )

                }
            );


        const text =
            await response.text();


        let data;


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

            const googleMessage =
                data?.error?.message ||
                "Unknown Google Places error.";


            console.error(
                "BOKKARA GOOGLE ERROR:",
                data
            );


            throw new Error(
                googleMessage
            );

        }


        return data;

    }


    /* =====================================================
       GOOGLE PLACE DETAILS
       
       Same backend.
       
       Call:
       
       /api/places/search?placeId=GOOGLE_PLACE_ID
    ====================================================== */

    async function getPlaceDetails(
        id
    ) {

        if (
            typeof id !== "string" ||
            !id.trim()
        ) {

            throw new Error(
                "A valid Google Place ID is required."
            );

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
            "BOKKARA GOOGLE PLACE DETAILS:",
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
                            FIELD_MASK

                    }

                }
            );


        const text =
            await response.text();


        let data;


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


            throw new Error(
                "Google Places returned invalid JSON."
            );

        }


        console.log(
            "BOKKARA DETAILS STATUS:",
            response.status
        );


        if (!response.ok) {

            const googleMessage =
                data?.error?.message ||
                "Unknown Google Places error.";


            console.error(
                "BOKKARA DETAILS ERROR:",
                data
            );


            throw new Error(
                googleMessage
            );

        }


        return data;

    }


    /* =====================================================
       PHOTO URL
       
       Google returns photo resource names.
       
       We keep the Google photo information AND create
       convenient URLs through the existing photo endpoint.
    ====================================================== */

    function createPhotoUrl(
        photoName,
        width = 1200,
        height = 1200
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
       
       IMPORTANT:
       
       We DO NOT replace Google's photo data.
       
       We keep Google's complete photo object and add
       convenient photoUrl / proxyUrl values.
    ====================================================== */

    function enrichPhotos(
        photos
    ) {

        if (
            !Array.isArray(photos)
        ) {

            return [];

        }


        return photos.map(
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
                            1200,
                            1200
                        ),

                    thumbnailUrl:
                        createPhotoUrl(
                            photoName,
                            600,
                            600
                        )

                };

            }
        )
        .filter(Boolean);

    }


    /* =====================================================
       NORMALIZE GOOGLE PLACE
       
       VERY IMPORTANT:
       
       `google` contains the COMPLETE ORIGINAL GOOGLE
       PLACE OBJECT.
       
       Nothing from Google is thrown away.
    ====================================================== */

    function normalizeGooglePlace(
        place
    ) {

        if (!place) {

            return null;

        }


        const placeResourceName =
            typeof place.name === "string"
                ? place.name
                : "";


        const extractedPlaceId =
            place.id ||
            extractPlaceId(
                placeResourceName
            ) ||
            "";


        const photos =
            enrichPhotos(
                place.photos
            );


        const location =
            place.location ||
            {};


        return {

            /* =============================================
               STANDARD BOKKARA FIELDS
            ============================================== */

            placeId:
                extractedPlaceId,


            name:
                place.displayName?.text ||
                "",


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


            primaryType:
                place.primaryType ||
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


            photos,


            /* =============================================
               COMPLETE GOOGLE OBJECT
               
               NOTHING IS LOST.
            ============================================== */

            google: {

                ...place,

                photos

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
       PLACE DETAILS REQUEST
       
       If frontend sends:
       
       ?placeId=ChIJ...
       
       return the complete Google Place.
    ====================================================== */

    if (placeId) {

        try {

            const googlePlace =
                await getPlaceDetails(
                    placeId
                );


            const place =
                normalizeGooglePlace(
                    googlePlace
                );


            if (!place) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Google Place was not found.",

                    place:
                        null

                });

            }


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


            const googleData =
                await googleRequest(
                    TEXT_SEARCH_URL,
                    body
                );


            const googlePlaces =
                Array.isArray(
                    googleData.places
                )
                    ? googleData.places
                    : [];


            const places =
                googlePlaces
                    .map(
                        normalizeGooglePlace
                    )
                    .filter(Boolean);


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
                   ORIGINAL GOOGLE RESPONSE
                   
                   NOTHING LOST.
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

    const allPlaces = [];


    const googleResponses = [];


    /* =====================================================
       RUN GOOGLE NEARBY SEARCH
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
                await googleRequest(
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

                const normalized =
                    normalizeGooglePlace(
                        place
                    );


                if (normalized) {

                    allPlaces.push(
                        normalized
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
       DEDUPLICATE
    ====================================================== */

    let places =
        deduplicatePlaces(
            allPlaces
        );


    /* =====================================================
       LIMIT
    ====================================================== */

    places =
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
           GOOGLE RESPONSES
           
           Every Google response is also returned.
           
           This means if Google adds something that our
           convenience normalization doesn't explicitly
           understand, your frontend still has access to it.
        ================================================ */

        google:
            googleResponses

    });

}


/* =========================================================
   EXTRACT PLACE ID
========================================================= */

function extractPlaceId(
    resourceName
) {

    if (
        typeof resourceName !==
        "string"
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
