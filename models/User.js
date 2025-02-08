const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  avatar: String,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
});

module.exports = mongoose.model("User", UserSchema);
