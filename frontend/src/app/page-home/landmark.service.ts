import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http"
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";
import { environment } from "../../environments/environment.development";
import { Landmark } from "../general/landmark-card.model";
import { Location } from '@angular/common';


const LANDMARKS_URL = environment.apiUrl + environment.landmarks
const EDITLANDMARK_URL = environment.apiUrl + environment.editLandmark

@Injectable({ providedIn: 'root' })
export class LandmarkServices {
  
    private landmarks = new BehaviorSubject<Landmark[]>([]);
    private landmarkData = new BehaviorSubject<Landmark[]>([]);

    constructor(private http: HttpClient , private location: Location) {
        this.getLandmarks()       
    }
  
    getLandmarksListener(): Observable<Landmark[]> {
      return this.landmarks.asObservable(); 
    }  
    getLandmarkListener(){
      return this.landmarkData.asObservable()
    }

    getLandmarks(): void {      
      this.http.get<{ message: string, data: Landmark[] }>(`${LANDMARKS_URL}`).subscribe(
        result => {
          this.landmarks.next(result.data)          
        },
        err => {
          console.error(err);
        }
      );
    }
    getLandmark(): void {      
      const path = this.location.path();
      const parts = path.split('/'); 
      let landmarkID = parts[parts.length - 1]; 
      this.http.get<{message:string , data:Landmark[]}>(`${LANDMARKS_URL}/${landmarkID}`).subscribe(result  =>{
         this.landmarkData.next(result.data)
      }, err=> {          
         console.error(err)
      })
    }
    updateLandmark(_id:string , title:string , short_info:string , description:string): Observable<{ message: string }> {     
      return this.http.put<{ message: string }>(`${EDITLANDMARK_URL}/${_id}`, { _id, title, short_info, description });
    }
  
}