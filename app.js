const express = require("express");
const cros = require("cors");
const requestIp = require("request-ip");
require("dotenv").config();
const dns = require("dns");
const mongoos = require("mongoose");
const UAParser = require("ua-parser-js");
const MONGO_CONNECT = process.env.MONGO_URI || "mongodb://localhost:27017/smvd";
const PORT_NO = "3030";

if (MONGO_CONNECT.startsWith("mongodb+srv://")) {
  dns.setServers(
    (process.env.MONGO_DNS_SERVERS || "1.1.1.1,8.8.8.8")
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

const app = express();

app.use(express.json());
app.use(cros());
app.use(requestIp.mw());

const User = require("./models/user");

const publicRoutes = require("./routes/public");

app.use((req, res, next) => {
  User.findOne({ ip: req.clientIp })
    .then((user) => {
      if (!user) {
        const useragent = req.headers["user-agent"];
        let parser = new UAParser(useragent);
        let parserResults = parser.getResult();
        console.log(parserResults);

        const newUser = new User({
          ip: req.clientIp,
          deviceInfo: parserResults,
          activity: [],
        });
        return newUser.save().then((result) => {
          User.findOne({ ip: req.clientIp }).then((user) => {
            req.users = user;
            next();
          });
        });
      } else {
        req.users = user;
        next();
      }
    })
    .catch((err) => {
      console.log(err);
      next(new Error(err));
    });
});

app.use(publicRoutes);

mongoos
  .connect(MONGO_CONNECT)
  .then((result) => {
    app.listen(process.env.PORT || PORT_NO, () => {
      console.log(`Server Rnning On ${PORT_NO}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
