# 🌀 botDL — Social Media Video Downloader

A modern, premium web application for downloading videos from YouTube, TikTok, Instagram, Facebook, and more.

---

## ✨ Features

- 🎬 Download from YouTube, TikTok, Instagram, Facebook, Vimeo, Twitter/X
- 📱 Multiple quality options: 144p, 360p, 480p, 720p, 1080p, MP3 audio
- 🎨 Premium dark UI with glassmorphism, animations, and neon accents
- 📋 Paste any link and auto-analyze
- 📊 Real-time download progress bar
- 🕐 Download history stored in browser (localStorage)
- 📱 Fully mobile-responsive

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pip install flask yt-dlp flask-cors
```

### 2. Run the server

```bash
python app.py
# or
bash start.sh
```

### 3. Open your browser

```
http://localhost:5000
```

---

## 🏗️ Project Structure

```
videodl/
├── app.py              # Flask backend
├── start.sh            # Startup script
├── README.md           # This file
├── templates/
│   └── index.html      # Frontend UI
└── static/
    └── downloads/      # Temporary download storage
```

---

## 🔌 API Reference

### POST `/analyze`

Analyzes a video URL and returns metadata + available formats.

**Request:**
```json
{ "url": "https://youtube.com/watch?v=..." }
```

**Response:**
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": "3:45",
  "platform": "YouTube",
  "uploader": "Channel Name",
  "formats": [
    { "quality": "720p", "ext": "mp4", "type": "video", "format_id": "..." },
    { "quality": "MP3 Audio", "ext": "mp3", "type": "audio" }
  ]
}
```

---

### POST `/download`

Downloads and streams the video file.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "format_id": "137",
  "quality": "720p",
  "type": "video",
  "ext": "mp4"
}
```

**Response:** Binary file stream (MP4 or MP3)

---

## ⚙️ Requirements

- Python 3.8+
- flask
- flask-cors
- yt-dlp
- ffmpeg (recommended for merging audio+video)

### Install ffmpeg (optional but recommended)

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
winget install ffmpeg
```

---

## 📝 Notes

- Downloads are streamed directly and temporary files are cleaned up automatically.
- yt-dlp is updated frequently — run `pip install -U yt-dlp` to get the latest version.
- Some platforms (like Instagram) may require authentication for private content.
- Respect copyright and terms of service of the platforms you download from.

---

## 📄 License

MIT License — for personal use only. Respect platform terms of service.
