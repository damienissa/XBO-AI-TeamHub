FROM node:20-alpine
RUN adduser -D appuser
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["npm", "run", "dev"]
