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
        "hasLocation:",
        hasLocation
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
            "amusement_park"

        ],


        shopping: [

            "shopping_mall",
            "department_store",
            "clothing_store",
            "supermarket",
            "convenience_store"

        ],


        services: [

            "bank",
            "pharmacy",
            "laundry",
            "car_repair",
            "beauty_salon"

        ]

    };


    const selectedTypes =
        CATEGORY_TYPES[category] ||
        CATEGORY_TYPES.food;


    /* =====================================================
       FIELD MASK
    ====================================================== */

    const FIELD_MASK = [

        "places.id",
        "places.name",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.primaryType",
        "places.currentOpeningHours",
        "places.photos"

    ].join(",");


    /* =====================================================
       GOOGLE ENDPOINTS
    ====================================================== */

    const TEXT_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchText";


    const NEARBY_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchNearby";


    /* =====================================================
       PHOTO PROXY BASE URL
    ====================================================== */

    const PHOTO_PROXY_BASE =
        "https://api-places-search-js.vercel.app/api/places/photo";


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
                JSON.parse(
                    text
                );

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


            throw new Error(
                googleMessage
            );

        }


        return data;

    }


    /* =====================================================
       PHOTO URL
    ====================================================== */

    function getPhotoUrl(
        place
    ) {

        if (
            !place ||
            !Array.isArray(place.photos) ||
            !place.photos.length
        ) {

            return "";

        }


        const photo =
            place.photos[0];


        if (
            !photo ||
            typeof photo.name !== "string" ||
            !photo.name.trim()
        ) {

            return "";

        }


        const photoName =
            photo.name.trim();


        /*
         * Google photo resource:
         *
         * places/PLACE_ID/photos/PHOTO_ID
         *
         * This is NOT directly usable by the browser.
         *
         * We send it through our own server-side
         * photo proxy.
         */

        return (
            PHOTO_PROXY_BASE +
            "?name=" +
            encodeURIComponent(
                photoName
            ) +
            "&width=800" +
            "&height=800"
        );

    }


    /* =====================================================
       NORMALIZE PLACE
    ====================================================== */

    function normalizeGooglePlace(
        place
    ) {

        if (!place) {

            return null;

        }


        const location =
            place.location ||
            {};


        const normalized = {

            placeId:
                place.id ||
                extractPlaceId(
                    place.name
                ) ||
                "",


            name:
                place.displayName?.text ||
                "",


            address:
                place.formattedAddress ||
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


            types:
                Array.isArray(
                    place.types
                )
                    ? place.types
                    : [],


            primaryType:
                place.primaryType ||
                null,


            openNow:
                place.currentOpeningHours?.openNow ??
                null,


            photoUrl:
                getPhotoUrl(
                    place
                )

        };


        /*
         * DEBUG
         */

        console.log(
            "BOKKARA NORMALIZED PLACE:",
            {
                name:
                    normalized.name,

                placeId:
                    normalized.placeId,

                googlePhotos:
                    Array.isArray(place.photos)
                        ? place.photos.length
                        : 0,

                googlePhotoName:
                    Array.isArray(place.photos) &&
                    place.photos[0]
                        ? place.photos[0].name
                        : "",

                photoUrl:
                    normalized.photoUrl
            }
        );


        return normalized;

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
                            10000

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
                                    : null

                        }
                        : null,

                places

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
       RUN CATEGORY TYPES
    ====================================================== */

    const allPlaces = [];


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
                            10000

                    }

                }

            };


            const googleData =
                await googleRequest(
                    NEARBY_SEARCH_URL,
                    body
                );


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
                "BOKKARA TYPE FAILED:",
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
                    : null

        },

        places

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
