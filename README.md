# 🪷 Namaste Hindi (नमस्ते हिंदी)
> Modern, interactive Devanagari script & 1000 core vocabulary learning platform for Android.

[![Android SDK](https://img.shields.io/badge/Android%20SDK-24%2B-brightgreen.svg)](https://developer.android.com)
[![Kotlin](https://img.shields.io/badge/Kotlin-2.0.21-blue.svg)](https://kotlinlang.org)
[![Gradle](https://img.shields.io/badge/AGP-8.8.0-orange.svg)](https://developer.android.com/studio/releases/gradle-plugin)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

**Namaste Hindi** is a native Android application designed for mastering Devanagari script, Hindi pronunciation, and high-frequency vocabulary. Built with a responsive hybrid architecture, it combines native Android system APIs (TextToSpeech, Haptics, Display Cutout Insets, S-Pen Stylus Interop) with high-performance hardware-accelerated web views.

---

## 🌟 Key Features

### 🔤 Devanagari Script Mastery
- **79 Characters**: Full Devanagari alphabet covering Vowels (*स्वर*), Consonants (*व्यंजन*), Vowel Signs (*मात्राएँ*), Conjuncts (*संयुक्त अक्षर*), and Numbers (*संख्याएँ*).
- **Interactive Flashcards**: 3D flip card mode with native Hindi audio pronunciation, transliteration, sound guides, and example words.

### 📚 1000 Core Vocabulary & Spaced Repetition (SRS)
- **20 Structured Decks**: 50 frequency-ranked Hindi words per deck with authentic Devanagari, Romanization, parts of speech, and context sentences.
- **SRS Flashcards Engine**: Smart Spaced Repetition reviewing (*Hard / Again*, *Good*, *Easy / Mastered*) to lock vocabulary into long-term memory.
- **Vocabulary Explorer**: Instant search in Devanagari, English, or transliteration.

### ✍️ Interactive Writing & Stroke Canvas
- **Practice Drawing**: Canvas for tracing and writing Devanagari characters with watermarks and step-by-step stroke guidance.
- **Samsung S-Pen & Stylus Ready**: Pressure sensitivity and Palm Rejection support optimized for Galaxy S24 Ultra & S-Pen devices.

### ⚙️ Custom Word Decks & JSON Import / Export
- **Create Custom Decks**: Organise your vocabulary into custom named decks (*e.g. Travel, Medical, Grammar*).
- **JSON Import**: Import custom vocabulary lists via `.json` files to expand flashcard decks, search, and quizzes.
- **JSON Export**: Export your complete vocabulary data for backup or sharing.

### 📊 Multi-User Profiles & Progress Tracking
- **Learner Profiles**: Switch between different user profiles or create new learner profiles.
- **Offline Storage**: All study stats, SRS reviews, drawing progress, and streaks saved locally using `localStorage`.

### 🌙 AMOLED True Dark Mode
- Clean, vibrant light aesthetic and AMOLED true dark mode toggle.
- Full camera notch & display cutout safe area handling.

---

## 🏗️ Architecture & Tech Stack

- **Android Native Layer**:
  - **Language**: Kotlin 2.0.21
  - **UI Shell**: AndroidX AppCompat, Edge-to-Edge `WindowCompat`, `WindowInsetsCompat` for display cutouts
  - **Native Bridge**: `JavascriptInterface` bridging native TextToSpeech (`android.speech.tts.TextToSpeech`) and haptic feedback (`Vibrator` / `VibratorManager`)
  - **Target SDK**: 35 (Android 15) | **Min SDK**: 24 (Android 7.0) | **JDK**: Java 17

- **Frontend Application Layer**:
  - **Core**: HTML5, CSS3 Variables, Vanilla ES6+ JavaScript
  - **Assets**: Embedded local assets (`app/src/main/assets/www/`) loaded securely via AndroidX `WebViewAssetLoader`

---

## 📁 Repository Structure

```
.
├── app/
│   ├── build.gradle.kts                   # Module build configuration
│   └── src/main/
│       ├── AndroidManifest.xml             # Manifest & permissions
│       ├── java/com/namaste/hindi/
│       │   └── MainActivity.kt            # Native Activity, WebView & Android Bridge
│       ├── assets/www/
│       │   ├── index.html                 # Main App Markup
│       │   ├── styles.css                 # Responsive Design & Amoled Dark Mode
│       │   ├── app.js                     # State Engine, SRS, Modals, Canvas Logic
│       │   ├── letters.json               # Devanagari dataset
│       │   └── words.json                 # 1000 Core words dataset
│       └── res/                           # App Launcher Icons, Drawables & Values
├── build.gradle.kts                        # Top-level Gradle script
├── settings.gradle.kts                     # Subproject inclusions
├── gradle/libs.versions.toml               # Version Catalog
└── NamasteHindi-release.apk                # Pre-built release APK
```

---

## 🛠️ Prerequisites for Building

Before building the app, ensure you have:

1. **JDK 17** installed and configured in your environment.
2. **Android Studio** (Ladybug 2024.2.1 or newer recommended).
3. **Android SDK 35/36** installed via Android SDK Manager.
4. **Gradle 8.8** (included via Gradle Wrapper `gradlew`).

---

## 🚀 How to Build and Install

### Method 1: Building with Gradle CLI (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/YourUsername/NamasteHindi.git
   cd NamasteHindi
   ```

2. **Build the Release APK**:
   ```bash
   # On Linux / macOS
   ./gradlew app:assembleRelease

   # On Windows (PowerShell / Command Prompt)
   .\gradlew.bat app:assembleRelease
   ```

3. **Locate the Output APK**:
   The generated APK will be available at:
   ```
   app/build/outputs/apk/release/app-release.apk
   ```

4. **Install on Phone via ADB**:
   Connect your Android phone with **USB Debugging** enabled and run:
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

---

### Method 2: Building via Android Studio GUI

1. Open Android Studio.
2. Select **Open** and choose the `NamasteHindi` project root directory.
3. Wait for Gradle Sync to complete.
4. From the top menu, select:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Once the build finishes, click **locate** in the bottom-right notification popup to open the APK directory.

---

### Method 3: Direct APK Installation on Smartphone

1. Copy `NamasteHindi-release.apk` directly to your phone using USB, Google Drive, or Quick Share.
2. Open the **My Files** or **Downloads** app on your phone.
3. Tap `NamasteHindi-release.apk`.
4. Allow *"Install from unknown sources"* if prompted by Android, and tap **Install**.

---

## 📥 Custom Word Deck Import JSON Schema

To import custom word lists into the app via **Settings (`⚙️`) > Import Custom Word Deck**, format your `.json` file as an array of objects matching this schema:

```json
[
  {
    "hindi": "पानी",
    "transliteration": "paani",
    "english": "water",
    "deck": 1,
    "part_of_speech": "noun",
    "example_hindi": "मुझे पानी चाहिए।",
    "example_transliteration": "mujhe paani chahiye.",
    "example_english": "I want water."
  }
]
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
