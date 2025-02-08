const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// Setting up for uploading avatars
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads/"),
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Главная страница
router.get("/", (req, res) => {
  res.render("index", { title: "Welcome" });
});


// registration route
router.get("/register", (req, res) => res.render("register", { error: null }));
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.render("register", { error: "This email has already been registered." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await new User({ name, email, password: hashedPassword }).save();
  res.redirect("/login");
});

// Login route
router.get("/login", (req, res) => res.render("login", { error: null }));
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
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
});

// Protected page
router.get("/dashboard", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const user = await User.findById(req.session.user._id);
  if (!user) {
    req.session.destroy();
    return res.redirect("/login");
  }

  res.render("dashboard", { user });
});

// Log out of the system
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Uploading a profile photo
router.post("/upload", upload.single("avatar"), async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  if (!req.file) {
    return res.send("File upload error!");
  }

  await User.updateOne({ _id: req.session.user._id }, { avatar: req.file.filename });
  req.session.user.avatar = req.file.filename;
  res.redirect("/dashboard");
});

module.exports = router;
