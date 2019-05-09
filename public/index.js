// UI elements
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const videoElement = document.getElementById('videoElement');

connectButton.onclick = connect;
disconnectButton.onclick = disconnect;
generateOfferButton.onclick = generateOffer;

disconnectButton.disabled = true;

var pc1 = null;
var pc2 = null;
var stream1 = null;
var negotiating = false;

const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 0,
  voiceActivityDetection: false
};

const peerConnectionOptions = {
  iceServers: []
};

function getFormats(sdp) {
  const lines = sdp.split('\r\n');
  formats = [];
  for (const line of lines) {
    if (line.startsWith('m=video')) {
      const parts = line.split(' ');
      return parts.slice(3).join(' ');
    }
  }
}

function getVP8PayloadType(sdp) {
  const lines = sdp.split('\r\n');
  for (const line of lines) {
    if (line.startsWith('a=rtpmap') && line.indexOf('VP8') > -1) {
      const parts = line.split(' ');
      return parts[0].substr(9);
    }
  }
}

function getVP8RtxPayloadType(sdp, codec) {
  const lines = sdp.split('\r\n');
  for (const line of lines) {
    if (line.startsWith('a=fmtp') && line.indexOf(`apt=${codec}`) > -1) {
      const parts = line.split(' ');
      return parts[0].substr(7);
    }
  }
}

function removeCodec(sdp) {
  let video = false;
  const lines = sdp.split('\r\n');
  const newLines = [];
  const codecs = getFormats(sdp);
  console.info(`Offered codecs: ${codecs}`);
  const vp8PayloadType = getVP8PayloadType(sdp);
  const vp8RtxPayloadType = getVP8RtxPayloadType(sdp, vp8PayloadType);
  console.info(`VP8 payload type: ${vp8PayloadType}, RTX: ${vp8RtxPayloadType}`);
  if (codecs.includes(vp8PayloadType) && codecs.includes(vp8RtxPayloadType)) {
    lines.forEach(line => {
      if (line.startsWith('m=video')) {
        video = true;
        const parts = line.split(' ');
        newLines.push([parts[0], parts[1], parts[2], `${vp8PayloadType} ${vp8RtxPayloadType}`].join(' '));
      }
      else if (video && (line.startsWith('a=rtpmap')
        || line.startsWith('a=rtcp-fb')
        || line.startsWith('a=fmtp'))) {
          if (line.indexOf(vp8PayloadType) > -1 || line.indexOf(vp8RtxPayloadType) > -1) {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    });
    return newLines.join('\r\n');
   } else {
     return sdp;
   }
}

async function negotiate() {
  if (negotiating) {
    return;
  }
  negotiating = true;
  console.info('Negotiating');
  try {
    const offer = await pc1.createOffer(offerOptions);
//    console.info(`Offer: ${offer.sdp}`);
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);
    const answer = await pc2.createAnswer();
//    console.info(`Answer: ${answer.sdp}`);
    await pc2.setLocalDescription(answer);
    const vp8OnlySdp = removeCodec(answer.sdp);
//    console.info(vp8OnlySdp);
    const vp8OnlyAnswer = new RTCSessionDescription({type: 'answer', sdp: vp8OnlySdp});
    await pc1.setRemoteDescription(vp8OnlyAnswer);
//    await pc1.setRemoteDescription(answer);
    negotiating = false;
  } catch(error) {
    console.info(`Negotiation failed: ${error}`);
  }
}

async function connect() {
  try {
    const constraints = {audio: true, video: true};

    stream1 = await navigator.mediaDevices.getUserMedia(constraints);

    pc1 = new RTCPeerConnection(peerConnectionOptions);
    pc1.onicecandidate = (c) => {
      if (c.candidate != null) {
        console.info(`PC1 ice candidate: ${c.candidate.candidate}`);
      } else {
        console.info('PC1 null candidate');
      }
      pc2.addIceCandidate(c.candidate).catch(error => {
        console.info(`Error adding ice candidate to PC2: ${error.toString()}`);
      });
    };
    pc1.oniceconnectionstatechange = (e) => {
      console.info(`PC1 ice connection state: ${e.currentTarget.iceConnectionState}`);
      if (e.currentTarget.iceConnectionState === 'connected') {
        connectButton.disabled = true;
        disconnectButton.disabled = false;
      }
    };
    pc1.onnegotiationneeded = (e) => {
      console.info('PC1 onnegotiationneeded');
      negotiate();
    };
    if (pc1.addTrack != null) {
      stream1.getTracks().forEach(track => {
        console.info(`PC1 adding track: ${track.kind}: ${track.id}`);
        pc1.addTrack(track, stream1);
      });
    } else {
      pc1.addStream(stream1);
    }

    pc2 = new RTCPeerConnection(peerConnectionOptions);
    pc2.onicecandidate = (c) => {
      if (c.candidate != null) {
        console.info(`PC2 ice candidate: ${c.candidate.candidate}`);
      } else {
        console.info('PC2 null candidate');
      }
      pc1.addIceCandidate(c.candidate).catch(error => {
        console.info(`Error adding ice candidate to PC1: ${error.toString()}`);
      });
    };
    pc2.oniceconnectionstatechange = (e) => {
      console.info(`PC2 ice connection state: ${e.currentTarget.iceConnectionState}`);
    };
    pc2.ontrack = (t) => {
      console.info(`PC2 track received: ${t.track.kind}: ${t.track.id}`);
      videoElement.srcObject = t.streams[0];
    }
  } catch(error) {
    console.info(`getUserMedia error: ${error.toString()}`);
  }
}

function disconnect() {
  if (pc1 != null) {
    pc1.close();
    pc1 = null;
  }
  if (pc2 != null) {
    pc2.close();
    pc2 = null;
  }
  connectButton.disabled = false;
  disconnectButton.disabled = true;
}

async function generateOffer() {
  if (pc1 == null) {
    return;
  }
  try {
    const offer = await pc1.createOffer(offerOptions);
    console.info(`Offered codecs: ${getFormats(offer.sdp)}`);
  } catch(error) {
    console.info(`Failed to generate offer: ${error}`);
  }
}
