const mongoose = require("mongoose")
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function connectToDB() {
    if (!process.env.MONGO_URI) {
        console.warn("MONGO_URI is not set. Skipping database connection.")
        return false
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            retryWrites: true
        })

        console.log("Connected to Database")
        return true
    }
    catch (err) {
        console.error("Database connection failed:")
        console.error(err)
        return false
    }
}

module.exports = connectToDB;
