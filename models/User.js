const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String }, // Имя файла для аватара
  loginAttempts: { type: Number, default: 0 }, // Счётчик неудачных попыток
  lockUntil: { type: Date, default: null }, // Время блокировки аккаунта
});

module.exports = mongoose.model("User", userSchema);
