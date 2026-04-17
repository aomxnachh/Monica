FROM node:22-slim

# Install yt-dlp + ffmpeg
RUN apt-get update && apt-get install -y ffmpeg curl python3 \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install

COPY . .
RUN npm run build

CMD ["node", "dist/main.js"]
