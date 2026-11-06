FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY *.js ./
COPY prompts ./prompts
ENV PORT=8080
ENV DATA_DIR=/data
ENV SAMPLES_DIR=/samples
EXPOSE 8080
CMD ["node","server.js"]
