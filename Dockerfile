FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

# Creating the data directory so sqlite can save nicely
RUN mkdir -p data

COPY . .

# Required environment port, should match .env
EXPOSE 1075

CMD ["npm", "run", "backend-only"]
