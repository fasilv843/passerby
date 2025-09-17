import { Socket } from "socket.io";

// export interface User {
//     socket: Socket;
//     id: string;
// }

export interface Room {
    id: string;
    user1Id: string;
    user2Id: string;
}


export interface OfferData {
    roomId: string;
    offer: string;
}

export interface AnswerData {
    roomId: string;
    answer: string;
}

export interface AddIceCandidateData {
    roomId: string;
    candidate: string;
}
