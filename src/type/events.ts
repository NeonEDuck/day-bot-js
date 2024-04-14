import { Awaitable, Client, ClientEvents } from 'discord.js'

export type EventListenerType<Events extends keyof ClientEvents> = (client: Client, ...args: ClientEvents[Events]) => Awaitable<void>

export type EventsWithListenerType<Events extends keyof ClientEvents> = {
    eventType: Events,
    listener: EventListenerType<Events>,
}

export function EventsWithListener<Events extends keyof ClientEvents>(eventsWithListener: EventsWithListenerType<Events>): EventsWithListenerType<Events>
export function EventsWithListener<Events extends keyof ClientEvents>(event: Events, eventListener: EventListenerType<Events>): EventsWithListenerType<Events>
export function EventsWithListener<Events extends keyof ClientEvents>(arg1: Events | EventsWithListenerType<Events>, arg2?: EventListenerType<Events>): EventsWithListenerType<Events> {
    if (arg2) {
        return {eventType: arg1 as Events, listener: arg2}
    }
    return arg1 as EventsWithListenerType<Events>
}

export function isEventsWithListenerType<Events extends keyof ClientEvents>(eventsWithListener: {})
        : eventsWithListener is EventsWithListenerType<Events> {
    return 'eventType' in eventsWithListener && 'listener' in eventsWithListener
}

export function isArrayOfEventsWithListenerType<Events extends keyof ClientEvents>(arrayOfEventsWithListener: {})
        : arrayOfEventsWithListener is EventsWithListenerType<Events>[] {
    return Array.isArray(arrayOfEventsWithListener) && arrayOfEventsWithListener.every(e => isEventsWithListenerType(e))
}