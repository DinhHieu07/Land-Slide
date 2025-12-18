export interface Event {
    id: number;
    name: string;
    area_id: number | null;
    event_time: string;
    severity: number;
    probability: number;
    lat: number;
    lon: number;
    description: string | null;
}