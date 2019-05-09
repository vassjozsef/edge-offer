Edge Offer
==========

Simple script showing Microsoft Edge bug for PeerConnection#createOffer().
1. Create an offer, observer it has four codecs, 107 (H.264), 100 (VP8), 99 (RTX for H.264) and 96 (RTX for VP8).
2. Set local description
3. Create an answer (I use a different peer connection)
4. Remove H.264 and H.264 RTX from answer
5. Set remote description
6. Create an offer, observe that it only includes three codecs, 100 (VP8), 96 (RTX for VP8) and 107 (H.264). RTX for H.264 is missing.


Running
-------

    npm install
    npm start

Open [http://localhost:3000](http://localhost:3000) in Microsoft Edge, click the Connect button and then the Generate Offer button. Observer the console output for the offered codecs.

