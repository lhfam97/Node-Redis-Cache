const express = require("express");
const fetch = require("node-fetch");
const redis = require("redis");
const { RateLimiterRedis } = require("rate-limiter-flexible");

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.PORT || 6379;

const client = redis.createClient({
  port: REDIS_PORT,
  password: undefined
});

const limiter = new RateLimiterRedis({
  storeClient: client,
  keyPrefix: "ratelimit",
  points: 5,
  duration: 100
});

async function rateLimiter(req, res, next) {
  try {
    await limiter.consume(req.ip);
    return next();
  } catch (err) {
    return res.status(429).json("Too many requests");
  }
}
const app = express();

app.use(rateLimiter);
//Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} Github repos`;
}

async function getRepos(req, res, next) {
  try {
    console.log("Fetching Data...");

    const { username } = req.params;

    const response = await fetch(`https://api.github.com/users/${username}`);

    const { login, html_url, company, location, bio } = await response.json();

    // const repos = data.public_repos;

    const user = {
      login,
      html_url,
      company,
      location,
      bio
    };
    const user_json = JSON.stringify(user);
    // Set data to Redis

    client.setex(username, 3600, user_json);

    // res.send(setResponse(username, repos));
    res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500);
  }
}

// Cache middleware
function cache(req, res, next) {
  const { username } = req.params;
  // console.log(req.hostname + req.url);

  client.get(username, (err, data) => {
    if (err) throw err;

    if (data !== null) {
      // res.send(setResponse(username, data));
      let obj = JSON.parse(data);
      res.json(obj);
    } else {
      next();
    }
  });
}

app.get("/repos/:username", cache, getRepos);

app.listen(5000, () => {
  console.log(`App listening on port ${PORT}`);
});
