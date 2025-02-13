const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// Настройка хранилища для загрузки аватаров
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads/"),
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.get("/", (req, res) => {
  res.render("index", { title: "Welcome" });
});

router.get("/register", (req, res) => res.render("register", { error: null }));
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.render("register", { error: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("register", { error: "This email has already been registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await new User({ name, email, password: hashedPassword }).save();

    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.render("register", { error: "An error occurred during registration. Please try again later." });
  }
});

router.get("/login", (req, res) => res.render("login", { error: null }));
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { error: "Invalid email or password." });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.render("login", {
        error: `The account is temporarily blocked. Try again after ${remainingTime} minutes.`,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 10 * 60 * 1000;
        user.loginAttempts = 0;
        await user.save();
        return res.render("login", {
          error: "The account has been temporarily blocked for 10 minutes.",
        });
      }

      await user.save();
      return res.render("login", { error: "Invalid email or password." });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    req.session.user = { _id: user._id, name: user.name, email: user.email, avatar: user.avatar };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "An error occurred during login. Please try again later." });
  }
});

router.get("/dashboard", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const user = await User.findById(req.session.user._id);
  if (!user) {
    req.session.destroy();
    return res.redirect("/login");
  }

  res.render("dashboard", { user });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

router.post("/upload", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    if (!req.file) {
      return res.send("File upload error!");
    }

    await User.updateOne({ _id: req.session.user._id }, { avatar: req.file.filename });
    req.session.user.avatar = req.file.filename;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("File upload error:", err);
    res.send("An error occurred during file upload. Please try again later.");
  }
});

module.exports = router;
