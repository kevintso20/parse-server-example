export interface Landmark {
    _id: string;
    url:string,
    title: string;
    short_info: string;
    description: string;
    location: [number, number];
    order: number;
    photo: string;
    photo_thumb: string;
}