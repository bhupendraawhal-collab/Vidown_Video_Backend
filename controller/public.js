const axios = require("axios");
require("dotenv").config();
const aufs = require("all-url-file-size");

const missingApiKeyResponse = (res, service, envName) => {
  return res.status(500).json({
    status: "fail",
    error: `${service} API key missing. Add ${envName} in server/.env.`,
    code: 500,
  });
};

const apiErrorMessage = (error, service) => {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    `${service} API request failed. Check API key, RapidAPI subscription, quota, and video URL.`
  );
};

const getYoutubeVideoId = (ytUrl) => {
  try {
    const url = new URL(ytUrl);

    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0];
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      return url.pathname.split("/").filter(Boolean)[1];
    }

    return url.searchParams.get("v");
  } catch (error) {
    return "";
  }
};

exports.startApi = (req, res, next) => {
  res.status(200).json({ message: "Welcome To Vidown Api" });
};

exports.postYoutube = (req, res, next) => {
  const ytUrl = req.body.urls;

  if (!process.env.YT_API_KEY) {
    return missingApiKeyResponse(res, "YouTube", "YT_API_KEY");
  }

  const videoId = getYoutubeVideoId(ytUrl);

  if (!videoId) {
    return res.status(400).json({
      status: "fail",
      error: "Invalid YouTube URL.",
      code: 400,
    });
  }

  const options = {
    method: "GET",
    url: "https://yt-api.p.rapidapi.com/dl",
    params: { id: videoId },
    headers: {
      "X-RapidAPI-Key": process.env.YT_API_KEY,
      "X-RapidAPI-Host": "yt-api.p.rapidapi.com",
    },
  };

  try {
    axios
      .request(options)
      .then((response) => {
        const result = response.data;
        if (result.thumbnail && Array.isArray(result.formats)) {
          let dataList = result.formats.filter((obj) => obj.url).map((obj) => {
            return {
              url: obj.url,
              quality: obj.qualityLabel || obj.quality || "Video",
              size: (
                ((obj.bitrate || 0) * (+(obj.approxDurationMs || 0) / 1000)) /
                (8 * 1024 * 1024)
              ).toFixed(1),
            };
          });

          res.status(200).json({
            thumb: result["thumbnail"][2].url,
            urls: dataList,
            title: result["title"],
          });

          req.users
            .addActivity({ yturl: ytUrl })
            .then((result) => {
              // console.log(result);
            })
            .catch((err) => {
              const error = new Error(err);
              error.httpStatusCode = 500;
              return next(error);
            });
        } else {
          res.status(403).json({
            status: "fail",
            error: result.message || result.error || "YouTube API did not return downloadable formats for this video.",
            code: 403,
          });
        }
      })
      .catch((error) => {
        console.log("YouTube API error:", error.response?.data || error.message);
        res.status(403).json({
          status: "fail",
          error: apiErrorMessage(error, "YouTube"),
          code: 403,
        });
        const err = new Error(error);
        err.httpStatusCode = 403;
        return next(err);
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "fail",
      error: "An unexpected error occurred. Please try again later.",
      code: 500,
    });
    const err = new Error(error);
    err.httpStatusCode = 500;
    return next(err);
  }
};

exports.postTwitter = async (req, res, next) => {
  const twUrl = req.body.urls;

  if (!process.env.TW_API_KEY) {
    return missingApiKeyResponse(res, "Twitter/X", "TW_API_KEY");
  }

  const options = {
    method: "POST",
    url: "https://twitter65.p.rapidapi.com/api/twitter/links",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": process.env.TW_API_KEY,
      "X-RapidAPI-Host": "twitter65.p.rapidapi.com",
    },
    data: {
      url: twUrl,
    },
  };

  try {
    axios
      .request(options)
      .then((response) => {
        const data = response.data;
        let dataList = [];

        let dataUrl = data[0].urls;

        for (let i = 0; i < dataUrl.length; i++) {
          aufs(dataUrl[i].url, "MB")
            .then((size) => {
              dataList.push({
                url: dataUrl[i].url,
                quality: dataUrl[i].subName + "P",
                size: size.toFixed(1),
              });
            })
            .then((result) => {
              console.log(dataList);
              if (dataList.length === dataUrl.length) {
                res.status(200).json({
                  thumb: data[0]["pictureUrl"],
                  urls: dataList,
                  title: data[0]["meta"]["title"],
                });
                req.users
                  .addActivity({ twUrl: twUrl })
                  .then((result) => {
                    console.log(result);
                  })
                  .catch((err) => {
                    const error = new Error(err);
                    error.httpStatusCode = 500;
                    return next(error);
                  });
              }
            });
        }
      })
      .catch((err) => {
        console.log("Twitter API error:", err.response?.data || err.message);
        res.status(403).json({
          status: "fail",
          error: apiErrorMessage(err, "Twitter/X"),
          code: 403,
        });

        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "fail",
      error: "An unexpected error occurred. Please try again later.",
      code: 500,
    });
    const err = new Error(error);
    err.httpStatusCode = 500;
    return next(err);
  }
};

exports.postFb = (req, res, next) => {
  const fbUrl = req.body.urls;

  if (!process.env.FB_API_KEY) {
    return missingApiKeyResponse(res, "Facebook", "FB_API_KEY");
  }

  const options = {
    method: 'GET',
    url: 'https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php',
    params: {
      url: fbUrl
    },
    headers: {
      'x-rapidapi-key': process.env.FB_API_KEY,
      'x-rapidapi-host': 'facebook-reel-and-video-downloader.p.rapidapi.com'
    }
  };

  axios
    .request(options)
    .then((response) => {
      const dataList = response.data;
      const format = dataList.links;

      if (dataList.error === true) {
        return res.status(403).json({
          status: "fail",
          error:
            "Sorry, we couldn't locate the video you're looking for. It's possible that the video is set to private or has been removed.",
          code: 403,
        });
      }

      const formatEntries = Object.entries(format);
      const sizePromises = formatEntries.map(([key, url]) =>
        aufs(url, "MB").then((size) => ({
          url: url,
          quality: key.toUpperCase(),
          size: size.toFixed(1),
        }))
      );

      Promise.all(sizePromises)
        .then((urls) => {
          res.status(200).json({
            thumb: dataList["thumbnail"],
            urls: urls,
            title: dataList?.["description"] || "Your Facebook Videos",
          });
          return req.users.addActivity({ fbUrl: fbUrl });
        })
        .then((result) => {
          console.log(result);
        })
        .catch((err) => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        });
    })
    .catch((err) => {
      console.log("Facebook API error:", err.response?.data || err.message);
      res.status(403).json({
        status: "fail",
        error: apiErrorMessage(err, "Facebook"),
        code: 403,
      });

      const error = new Error(err);
      error.httpStatusCode = 403;
      return next(error);
    });
};

exports.otherPost = (req, res, next) => {
  const igUrl = req.body.urls;

  if (!process.env.IG_API_KEY) {
    return missingApiKeyResponse(res, "Instagram", "IG_API_KEY");
  }

  const encodedParams = new URLSearchParams();
  encodedParams.set('url', igUrl);

  const options = {
    method: 'POST',
    url: 'https://snap-video3.p.rapidapi.com/download',
    headers: {
      'x-rapidapi-key': process.env.IG_API_KEY,
      'x-rapidapi-host': 'snap-video3.p.rapidapi.com',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: encodedParams,
  };

  axios
    .request(options)
    .then((response) => {
      const formats = response.data;
      const videData = formats.medias;

      if (formats.error === true) {
        return res.status(403).json({
          status: "fail",
          error:
            "Sorry, we couldn't locate the video you're looking for. It's possible that the video is set to private or has been removed.",
          code: 403,
        });
      }

      const sizePromises = videData.map(data =>
        aufs(data.url, "MB").then((size) => ({
          url: data.url,
          quality: data.quality.length > 1 ? data.quality.toUpperCase() : "720P",
          size: size.toFixed(1),
        }))
      );

      Promise.all(sizePromises)
        .then((urls) => {
          res.status(200).json({
            thumb: formats.thumbnail,
            urls: urls,
            title: formats.title ||  "Your IG Videos",
          });
          return req.users.addActivity({ igUrl: igUrl });
        })
        .then((result) => {
          console.log("OK");
        })
        .catch((err) => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        });
    })
    .catch((err) => {
      console.log("Instagram API error:", err.response?.data || err.message);
      res.status(403).json({
        status: "fail",
        error: apiErrorMessage(err, "Instagram"),
        code: 403,
      });

      const error = new Error(err);
      error.httpStatusCode = 403;
      return next(error);
    });
};
