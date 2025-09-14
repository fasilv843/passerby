import { Socket } from "socket.io";

export interface User {
    socket: Socket;
    id: string;
}

export interface Room {
    id: string;
    user1: User;
    user2: User;
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
