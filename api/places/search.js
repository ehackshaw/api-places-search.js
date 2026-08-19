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
            "Missing GOOGLE_PLACES_API_KEY environment variable."
        );


        return res.status(500).json({

            success: false,

            error:
                "Google Places API key is not configured."

        });

    }


    /* =====================================================
       READ QUERY PARAMETERS
    ====================================================== */

    const {

        query = "",

        category = "food",

        latitude,

        longitude,

        accuracy,

        types

    } = req.query;


    const cleanQuery =
        String(query || "").trim();


    const cleanCategory =
        String(category || "food")
            .trim()
            .toLowerCase();


    /* =====================================================
       VALIDATE COORDINATES
    ====================================================== */

    const lat =
        latitude !== undefined
            ? Number(latitude)
            : null;


    const lng =
        longitude !== undefined
            ? Number(longitude)
            : null;


    const hasLocation =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;


    /* =====================================================
       SEARCH TYPE DEFINITIONS
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


    /* =====================================================
       GET CATEGORY TYPES
    ====================================================== */

    let categoryTypes =
        CATEGORY_TYPES[cleanCategory];


    if (!Array.isArray(categoryTypes)) {

        categoryTypes =
            CATEGORY_TYPES.food;

    }


    /* =====================================================
       FRONTEND TYPES
    ====================================================== */

    let requestedTypes = [];


    if (types) {

        requestedTypes =
            String(types)
                .split(",")
                .map(
                    type =>
                        type.trim()
                )
                .filter(Boolean);

    }


    /*
     * Only allow Google place types that we have explicitly
     * defined.
     *
     * This prevents the browser from sending arbitrary
     * values directly into Google's API request.
     */

    const allowedTypes =
        new Set(

            Object.values(
                CATEGORY_TYPES
            ).flat()

        );


    requestedTypes =
        requestedTypes.filter(
            type =>
                allowedTypes.has(type)
        );


    /*
     * If the frontend didn't send valid types,
     * fall back to the selected category.
     */

    if (
        requestedTypes.length === 0
    ) {

        requestedTypes =
            categoryTypes;

    }


    /* =====================================================
       GOOGLE FIELD MASK
    ====================================================== */

    /*
     * We intentionally request only the fields required by
     * the Bokkara frontend.
     *
     * Google requires a field mask for Places API (New).
     *
     * Keeping this limited also avoids unnecessarily
     * requesting more place data than we need.
     */

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

        "places.currentOpeningHours"

    ].join(",");


    /* =====================================================
       GOOGLE API URLS
    ====================================================== */

    const GOOGLE_TEXT_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchText";


    const GOOGLE_NEARBY_SEARCH_URL =
        "https://places.googleapis.com/v1/places:searchNearby";


    /* =====================================================
       CHOOSE SEARCH METHOD
    ====================================================== */

    /*
     * If the user typed a query:
     *
     *     "KFC"
     *     "Maracas Beach"
     *     "MovieTowne"
     *     "restaurants"
     *
     * use Text Search.
     *
     *
     * If there is no query:
     *
     *     category = food
     *     latitude
     *     longitude
     *
     * use Nearby Search.
     */

    const useTextSearch =
        cleanQuery.length > 0;


    let googleResponse;


    /* =====================================================
       TEXT SEARCH
    ====================================================== */

    if (useTextSearch) {

        const textQuery =
            cleanQuery;


        const body = {

            textQuery:

                textQuery,

            pageSize:

                20

        };


        /*
         * Add location bias when browser location
         * is available.
         *
         * Google describes locationBias as a preference
         * around a location rather than a strict boundary.
         */

        if (hasLocation) {

            /*
             * Use a reasonable search radius.
             *
             * This is a bias, not a hard restriction.
             */

            body.locationBias = {

                circle: {

                    center: {

                        latitude: lat,

                        longitude: lng

                    },

                    radius: 10000

                }

            };

        }


        /*
         * For category searches, use Google's includedType
         * when we can safely determine a single type.
         *
         * Text Search accepts one includedType.
         */

        const categorySearchWords = [

            "restaurant",
            "restaurants",
            "cafe",
            "cafes",
            "bakery",
            "bar",
            "bars",
            "pharmacy",
            "bank",
            "laundry",
            "shopping",
            "mall",
            "supermarket",
            "museum",
            "park",
            "cinema",
            "movie",
            "attraction"

        ];


        const queryLower =
            textQuery.toLowerCase();


        let matchingType =
            null;


        for (
            const type of categorySearchWords
        ) {

            if (
                queryLower === type ||
                queryLower.includes(
                    type
                )
            ) {

                /*
                 * Map common search wording to a Google
                 * type.
                 */

                if (
                    type === "restaurants"
                ) {

                    matchingType =
                        "restaurant";

                }

                else if (
                    type === "cafes"
                ) {

                    matchingType =
                        "cafe";

                }

                else if (
                    type === "bars"
                ) {

                    matchingType =
                        "bar";

                }

                else if (
                    type === "mall" ||
                    type === "shopping"
                ) {

                    matchingType =
                        "shopping_mall";

                }

                else if (
                    type === "supermarket"
                ) {

                    matchingType =
                        "supermarket";

                }

                else if (
                    type === "movie"
                ) {

                    matchingType =
                        "movie_theater";

                }

                else if (
                    type === "cinema"
                ) {

                    matchingType =
                        "movie_theater";

                }

                else if (
                    type === "attraction"
                ) {

                    matchingType =
                        "tourist_attraction";

                }

                else {

                    matchingType =
                        type;

                }


                break;

            }

        }


        /*
         * Only use the includedType when the query is
         * clearly categorical.
         *
         * This prevents searches such as:
         *
         * "KFC Port of Spain"
         *
         * from being unnecessarily restricted.
         */

        if (
            matchingType &&
            (
                queryLower ===
                matchingType ||
                categorySearchWords.includes(
                    queryLower
                )
            )
        ) {

            body.includedType =
                matchingType;

        }


        googleResponse =
            await fetch(
                GOOGLE_TEXT_SEARCH_URL,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
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

    }


    /* =====================================================
       NEARBY SEARCH
    ====================================================== */

    else {

        /*
         * Nearby Search requires a location.
         *
         * If the user hasn't granted location access,
         * return a useful response instead of guessing.
         */

        if (!hasLocation) {

            return res.status(400).json({

                success: false,

                error:
                    "Location is required for a category search.",

                code:
                    "LOCATION_REQUIRED",

                places: []

            });

        }


        /*
         * Nearby Search supports multiple includedTypes.
         */

        const body = {

            includedTypes:
                requestedTypes,

            maxResultCount:
                20,

            rankPreference:
                "POPULARITY",

            locationRestriction: {

                circle: {

                    center: {

                        latitude:
                            lat,

                        longitude:
                            lng

                    },

                    /*
                     * Search radius.
                     *
                     * 10 km is large enough for the initial
                     * Bokkara Places experience while still
                     * keeping the search local.
                     */

                    radius:
                        10000

                }

            }

        };


        googleResponse =
            await fetch(
                GOOGLE_NEARBY_SEARCH_URL,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
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

    }


    /* =====================================================
       GOOGLE RESPONSE ERROR
    ====================================================== */

    if (
        !googleResponse.ok
    ) {

        let googleError;


        try {

            googleError =
                await googleResponse.json();

        }

        catch (error) {

            googleError = {

                error: {

                    message:
                        await googleResponse.text()

                }

            };

        }


        console.error(
            "Google Places API error:",
            JSON.stringify(
                googleError,
                null,
                2
            )
        );


        return res.status(
            googleResponse.status >= 400 &&
            googleResponse.status < 600
                ? googleResponse.status
                : 500
        ).json({

            success: false,

            error:
                "Google Places search failed.",

            details:
                googleError?.error?.message ||
                "Unknown Google Places error.",

            places: []

        });

    }


    /* =====================================================
       PARSE GOOGLE RESPONSE
    ====================================================== */

    const googleData =
        await googleResponse.json();


    const googlePlaces =
        Array.isArray(
            googleData.places
        )
            ? googleData.places
            : [];


    /* =====================================================
       NORMALIZE PLACES
    ====================================================== */

    const places =
        googlePlaces.map(
            normalizeGooglePlace
        );


    /* =====================================================
       RETURN RESPONSE
    ====================================================== */

    return res.status(200).json({

        success: true,

        count:
            places.length,

        category:
            cleanCategory,

        query:
            cleanQuery,

        location:

            hasLocation

                ? {

                    latitude:
                        lat,

                    longitude:
                        lng,

                    accuracy:
                        Number.isFinite(
                            Number(
                                accuracy
                            )
                        )
                            ? Number(
                                accuracy
                            )
                            : null

                }

                : null,

        places

    });

}


/* =========================================================
   NORMALIZE GOOGLE PLACE
========================================================= */

function normalizeGooglePlace(
    place
) {

    const location =
        place.location ||
        {};


    return {

        /*
         * Google Place ID
         */

        placeId:
            place.id ||
            extractPlaceId(
                place.name
            ) ||
            "",


        /*
         * Human-readable name
         */

        name:
            place.displayName?.text ||
            "",


        /*
         * Formatted address
         */

        address:
            place.formattedAddress ||
            "",


        /*
         * Coordinates
         */

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


        /*
         * Google rating
         */

        rating:
            place.rating ??
            null,


        /*
         * Number of ratings
         */

        userRatingCount:
            place.userRatingCount ??
            null,


        /*
         * Place types
         */

        types:
            Array.isArray(
                place.types
            )
                ? place.types
                : [],


        primaryType:
            place.primaryType ||
            null,


        /*
         * Current opening status
         */

        openNow:
            place.currentOpeningHours?.openNow ??
            null,


        /*
         * Google photo resources are deliberately NOT
         * converted here.
         *
         * We didn't request photos in the initial search
         * field mask.
         *
         * We'll add a dedicated photo/details endpoint
         * next so photo retrieval stays controlled.
         */

        photoUrl:
            null

    };

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
