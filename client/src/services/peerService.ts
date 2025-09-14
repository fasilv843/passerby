class PeerService {
    private static instance: PeerService;
    peer: RTCPeerConnection | null = null;

    static getInstance(): PeerService {
        if (!PeerService.instance) {
          PeerService.instance = new PeerService();
        }
        return PeerService.instance;
    }

    create(
        onTrack: (event: RTCTrackEvent) => void,
        onIceCandidate: (candidate: RTCPeerConnectionIceEvent) => void,
        onNegotiationNeeded: () => void
    ) {
        if (this.peer) {
            this.peer.close();
        }

        this.peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:global.stun.twilio.com:3478",
                    ],
                },
            ],
        });

        // 🚀 Add transceivers immediately after creating the peer
        this.peer.addTransceiver("audio", { direction: "sendrecv" });
        this.peer.addTransceiver("video", { direction: "sendrecv" });

        // attach event listeners
        this.peer.ontrack = onTrack;
        this.peer.onicecandidate = onIceCandidate;
        this.peer.onnegotiationneeded = onNegotiationNeeded;

        return this.peer;
    }

    reset(
        onTrack: (event: RTCTrackEvent) => void,
        onIceCandidate: (candidate: RTCPeerConnectionIceEvent) => void,
        onNegotiationNeeded: () => void
    ) {
        this.close();
        this.create(onTrack, onIceCandidate, onNegotiationNeeded);
    }

    close() {
        if (this.peer) {
            console.error('closing peer', 'in close', 'removing tracks');
            
            this.peer.getSenders().forEach(sender => {
                console.log('removing track', sender.track);
                this.peer!.removeTrack(sender);
            });
            this.peer.close();
            this.peer = null;
        }
    }

    addIceCandidate(candidate: RTCIceCandidateInit) {
        if (this.peer) {
            this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            console.warn('peer is not available', 'in addIceCandidate');
        }
    }

    addTracks(stream: MediaStream) {
        if (this.peer) {
            stream.getTracks().forEach((track) => {
                this.peer?.addTrack(track, stream);
            });
        } else {
            console.warn('peer is not available', 'in addTracks');
        }
    }


    async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
        if (this.peer) {
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            return offer;
        } else {
            console.warn('peer is not available', 'in getOffer');
        }
    }

    async getAnswer(
        offer: RTCSessionDescriptionInit
    ): Promise<RTCSessionDescriptionInit | undefined> {
        if (this.peer) {
            await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peer.createAnswer();
            await this.peer.setLocalDescription(answer);
            return answer;
        }
    }

    async setLocalDescription(answer: RTCSessionDescriptionInit): Promise<void> {
        if (this.peer) {
            await this.peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }
}

const peerService = PeerService.getInstance();

// const peerService = new PeerService();

export default peerService;
