const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cookieParser())
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
];

console.log("Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin(origin, callback) {
      console.log("Incoming Origin:", origin);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked Origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);


/* require all the routes here */
const authRouter = require("./routes/auth.route")
const interviewRouter = require("./routes/interview.route")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)



module.exports = app
