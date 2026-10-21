export interface Room {
    id: string;
    user1Id: string;
    user2Id: string;
}

export interface IceServer {
    urls: string[];
    username?: string;
    credential?: string;
}

/** Sent to each user when they are paired. */
export interface MatchedPayload {
    roomId: string;
    /** Perfect negotiation role: the polite peer yields when both send offers at once. */
    polite: boolean;
    iceServers: IceServer[];
}
