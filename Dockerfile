FROM node:12

WORKDIR /usr/src/cd-metrics-cli

COPY package*.json ./
RUN npm install

COPY . .
COPY ./cd-metrics.sh /

ENTRYPOINT ["/cd-metrics.sh"]
CMD [""]