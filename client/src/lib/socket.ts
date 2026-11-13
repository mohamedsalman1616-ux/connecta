import { io, Socket } from 'socket.io-client'; import { BASE, getToken } from './api';
let s: Socket | null = null;
export const connectSocket = () => { s?.disconnect(); s = io(BASE, { auth: (cb) => cb({ token: getToken() }), reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 5000 }); return s; };
export const getSocket = () => s;
export const closeSocket = () => { s?.disconnect(); s = null; };
