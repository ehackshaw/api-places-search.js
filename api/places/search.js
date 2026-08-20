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


    const photoName =
        typeof req.query.name === "string"
            ? req.query.name.trim()
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


    const requestedWidth =
        req.query.width !== undefined
            ? Number(req.query.width)
            : 1600;


    const requestedHeight =
        req.query.height !== undefined
            ? Number(req.query.height)
            : 1600;


    /* =====================================================
       PHOTO REQUEST DETECTION
       
       Supports BOTH:

       /api/places/photo?name=...
       
       AND

       /api/places/search?name=...&photo=1
    ====================================================== */

    const isPhotoRequest =
        !!photoName &&
        (
            req.query.photo === "1" ||
            req.query.media === "1" ||
            req.url?.includes("/api/places/photo")
        );


    /* =====================================================
       PHOTO PROXY
       
       GOOGLE PLACES PHOTO (NEW)
       
       Google photo resource:

       places/PLACE_ID/photos/PHOTO_REFERENCE
       
       Media endpoint:

       places/PLACE_ID/photos/PHOTO_REFERENCE/media
    ====================================================== */

    if (isPhotoRequest) {

        try {

            let cleanPhotoName =
                photoName.trim();


            /* =============================================
               NORMALIZE FULL GOOGLE URL
            ============================================== */

            if (
                cleanPhotoName.startsWith(
                    "https://places.googleapis.com/v1/"
                )
            ) {

                cleanPhotoName =
                    cleanPhotoName.replace(
                        "https://places.googleapis.com/v1/",
                        ""
                    );

            }


            /* =============================================
               NORMALIZE /v1/
            ============================================== */

            if (
                cleanPhotoName.startsWith(
                    "/v1/"
                )
            ) {

                cleanPhotoName =
                    cleanPhotoName.substring(4);

            }


            if (
                cleanPhotoName.startsWith(
                    "v1/"
                )
            ) {

                cleanPhotoName =
                    cleanPhotoName.substring(3);

            }


            /* =============================================
               REMOVE /media IF FRONTEND SENT IT
            ============================================== */

            cleanPhotoName =
                cleanPhotoName.replace(
                    /\/media\/?$/,
                    ""
                );


            /* =============================================
               VALIDATE PHOTO RESOURCE
            ============================================== */

            if (
                !cleanPhotoName.startsWith(
                    "places/"
                ) ||
                !cleanPhotoName.includes(
                    "/photos/"
                )
            ) {

                console.error(
                    "BOKKARA INVALID PHOTO NAME:",
                    cleanPhotoName
                );


                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Invalid Google Places photo name.",

                    photoName:
                        cleanPhotoName

                });

            }


            /* =============================================
               SAFE DIMENSIONS
            ============================================== */

            const width =
                Number.isFinite(
                    requestedWidth
                )
                    ? Math.min(
                        Math.max(
                            Math.round(
                                requestedWidth
                            ),
                            1
                        ),
                        4800
                    )
                    : 1600;


            const height =
                Number.isFinite(
                    requestedHeight
                )
                    ? Math.min(
                        Math.max(
                            Math.round(
                                requestedHeight
                            ),
                            1
                        ),
                        4800
                    )
                    : 1600;


            /* =============================================
               GOOGLE PHOTO MEDIA URL
            ============================================== */

            const googlePhotoUrl =
                "https://places.googleapis.com/v1/" +
                cleanPhotoName +
                "/media" +
                "?maxWidthPx=" +
                encodeURIComponent(width) +
                "&maxHeightPx=" +
                encodeURIComponent(height) +
                "&key=" +
                encodeURIComponent(
                    GOOGLE_API_KEY
                );


            console.log(
                "================================================="
            );

            console.log(
                "BOKKARA PHOTO REQUEST"
            );

            console.log(
                "PHOTO:",
                cleanPhotoName
            );

            console.log(
                "WIDTH:",
                width
            );

            console.log(
                "HEIGHT:",
                height
            );

            console.log(
                "================================================="
            );


            /* =============================================
               FETCH PHOTO
            ============================================== */

            const photoResponse =
                await fetch(
                    googlePhotoUrl,
                    {

                        method:
                            "GET",

                        headers: {

                            Accept:
                                "image/*"

                        },

                        redirect:
                            "follow"

                    }
                );


            console.log(
                "BOKKARA PHOTO GOOGLE STATUS:",
                photoResponse.status
            );


            /* =============================================
               GOOGLE ERROR
            ============================================== */

            if (!photoResponse.ok) {

                const errorText =
                    await photoResponse.text();


                console.error(
                    "BOKKARA GOOGLE PHOTO ERROR:",
                    errorText
                );


                return res.status(
                    photoResponse.status
                ).json({

                    success:
                        false,

                    error:
                        "Google Places photo request failed.",

                    details:
                        errorText ||
                        "Unknown Google photo error.",

                    photoName:
                        cleanPhotoName

                });

            }


            /* =============================================
               IMAGE BUFFER
            ============================================== */

            const imageBuffer =
                Buffer.from(
                    await photoResponse.arrayBuffer()
                );


            const contentType =
                photoResponse.headers.get(
                    "content-type"
                ) ||
                "image/jpeg";


            /* =============================================
               IMAGE HEADERS
            ============================================== */

            res.setHeader(
                "Content-Type",
                contentType
            );


            res.setHeader(
                "Content-Length",
                imageBuffer.length
            );


            res.setHeader(
                "Cache-Control",
                "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
            );


            res.setHeader(
                "CDN-Cache-Control",
                "public, max-age=86400"
            );


            res.setHeader(
                "Vercel-CDN-Cache-Control",
                "public, max-age=86400"
            );


            res.setHeader(
                "Access-Control-Allow-Origin",
                "*"
            );


            return res
                .status(200)
                .send(imageBuffer);

        }

        catch (error) {

            console.error(
                "BOKKARA PHOTO PROXY ERROR:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to load Google Places photo.",

                details:
                    error.message ||
                    "Unknown photo proxy error."

            });

        }

    }


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
        "QUERY:",
        query
    );

    console.log(
        "PLACE ID:",
        placeId
    );

    console.log(
        "CATEGORY:",
        category
    );

    console.log(
        "LATITUDE:",
        latitude
    );

    console.log(
        "LONGITUDE:",
        longitude
    );

    console.log(
        "RADIUS:",
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
       
       PHOTOS ARE EXPLICITLY REQUESTED.
       
       This is important.
    ====================================================== */

    const TEXT_SEARCH_FIELD_MASK =
        [
            "places.*",
            "places.photos",
            "nextPageToken"
        ].join(",");


    const NEARBY_SEARCH_FIELD_MASK =
        [
            "places.*",
            "places.photos"
        ].join(",");


    const DETAILS_FIELD_MASK =
        "*";


    /* =====================================================
       GOOGLE POST
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
       PHOTO PROXY BASE URL
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
       
       PRESERVES EVERY GOOGLE PHOTO.
       
       Google can return up to 10 photos.
    ====================================================== */

    function enrichPhotos(
        photos
    ) {

        if (
            !Array.isArray(photos)
        ) {

            return [];

        }


        console.log(
            "BOKKARA PHOTOS RECEIVED:",
            photos.length
        );


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
                            ? photo.name.trim()
                            : "";


                    if (!photoName) {

                        return {

                            ...photo,

                            index,

                            photoUrl:
                                "",

                            thumbnailUrl:
                                "",

                            largeUrl:
                                "",

                            mediaUrl:
                                ""

                        };

                    }


                    const photoUrl =
                        createPhotoUrl(
                            photoName,
                            1600,
                            1600
                        );


                    const thumbnailUrl =
                        createPhotoUrl(
                            photoName,
                            600,
                            600
                        );


                    const largeUrl =
                        createPhotoUrl(
                            photoName,
                            2400,
                            2400
                        );


                    const mediaUrl =
                        createPhotoUrl(
                            photoName,
                            4800,
                            4800
                        );


                    return {

                        /* =================================
                           ORIGINAL GOOGLE PHOTO
                        ================================== */

                        ...photo,


                        /* =================================
                           OUR INDEX
                        ================================== */

                        index,


                        /* =================================
                           GOOGLE RESOURCE NAME
                        ================================== */

                        name:
                            photoName,


                        resourceName:
                            photoName,


                        /* =================================
                           WORKING IMAGE URLS
                        ================================== */

                        photoUrl,

                        thumbnailUrl,

                        largeUrl,

                        mediaUrl,


                        /* =================================
                           DIMENSIONS
                        ================================== */

                        width:
                            photo.widthPx ||
                            null,

                        height:
                            photo.heightPx ||
                            null,


                        widthPx:
                            photo.widthPx ||
                            null,

                        heightPx:
                            photo.heightPx ||
                            null,


                        /* =================================
                           ATTRIBUTIONS
                        ================================== */

                        authorAttributions:
                            Array.isArray(
                                photo.authorAttributions
                            )
                                ? photo.authorAttributions
                                : [],


                        googleMapsUri:
                            photo.googleMapsUri ||
                            null,


                        flagContentUri:
                            photo.flagContentUri ||
                            null

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
       NORMALIZE PLACE
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


        /* =============================================
           PHOTOS
        ============================================== */

        const photos =
            enrichPhotos(
                place.photos
            );


        /* =============================================
           REVIEWS
        ============================================== */

        const reviews =
            enrichReviews(
                place.reviews
            );


        console.log(
            "BOKKARA NORMALIZE:",
            place.displayName?.text ||
            "",
            "PHOTO COUNT:",
            photos.length
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
               FIRST PHOTO CONVENIENCE
            ============================================== */

            photoUrl:
                photos[0]?.photoUrl ||
                "",

            thumbnailUrl:
                photos[0]?.thumbnailUrl ||
                "",

            largePhotoUrl:
                photos[0]?.largeUrl ||
                "",


            /* =============================================
               ALL PHOTO URLS
               
               Convenient for frontend galleries.
            ============================================== */

            photoUrls:
                photos
                    .map(
                        photo =>
                            photo.photoUrl
                    )
                    .filter(Boolean),


            thumbnailUrls:
                photos
                    .map(
                        photo =>
                            photo.thumbnailUrl
                    )
                    .filter(Boolean),


            largePhotoUrls:
                photos
                    .map(
                        photo =>
                            photo.largeUrl
                    )
                    .filter(Boolean),


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
               EDITORIAL
            ============================================== */

            editorialSummary:
                place.editorialSummary ||
                null,

            generativeSummary:
                place.generativeSummary ||
                null,


            /* =============================================
               COMPLETE GOOGLE OBJECT
            ============================================== */

            google: {

                ...place,

                photos,

                reviews

            }

        };

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
       GET PLACE ID
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
       ENRICH ONE PLACE
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
                    id
                );

                console.log(
                    "PHOTOS:",
                    Array.isArray(
                        details.photos
                    )
                        ? details.photos.length
                        : 0
                );

                console.log(
                    "REVIEWS:",
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
           FALLBACK TO SEARCH RESULT
        ============================================== */

        return normalizePlace(
            searchPlace
        );

    }


    /* =====================================================
       ENRICH ALL PLACES
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
               LOG PHOTO COUNTS BEFORE DETAILS
            ============================================== */

            searchPlaces.forEach(
                (p, index) => {

                    console.log(
                        "SEARCH PLACE",
                        index,
                        p.displayName?.text,
                        "PHOTOS:",
                        Array.isArray(
                            p.photos
                        )
                            ? p.photos.length
                            : 0
                    );

                }
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


            found.forEach(
                (p, index) => {

                    console.log(
                        "NEARBY PLACE",
                        index,
                        p.displayName?.text,
                        "PHOTOS:",
                        Array.isArray(
                            p.photos
                        )
                            ? p.photos.length
                            : 0
                    );

                }
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
       DEDUPLICATE BEFORE DETAILS
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

        google:
            googleResponses

    });

}
