# Mediasoup video conferencing

Example website for multi-party video/audio/screen conferencing using mediasoup. This project is intended to better understand how mediasoup works with a simple example.

This project is featured on the [mediasoup examples page](https://mediasoup.org/documentation/examples/) with many other examples. Checkout mediasoup at [mediasoup.org](https://mediasoup.org)

#Conditions
-pleas make surre that you have node version `22.11.0 `
-you installed node.js

# Running the code
-   run `npm install` and  then `npm start` to run the application. Then open your browser at `https://localhost:3000` or your own defined port/url in the config file.
-   (optional) edit the `src/config/Serverconfig.js` file according to your needs and replace the `ssl/key.pem ssl/cert.pem` certificates with your own.

# Deployment

-   in `config.js` replace the `announcedIP` with your public ip address of the server and modify the port you want to serve it in.
-   add firewall rules of the port of the webpage (default 3016) and the rtc connections (default udp 10000-10100) for the machine.

