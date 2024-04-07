import { Awaitable, Client, ClientEvents } from "discord.js";

export class EventsWithListener<Events extends keyof ClientEvents> {
    constructor(public event: Events, public listener: (client: Client, ...args: ClientEvents[Events]) => Awaitable<void>) { }
}