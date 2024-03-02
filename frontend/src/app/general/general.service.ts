import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http"
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { environment } from "../../environments/environment.development";
import { Landmark } from "./landmark-card.model";

const SEARCH_URL = environment.apiUrl + environment.search

@Injectable({ providedIn: 'root' })
export class GeneralServices {
  
    private searchedLandmarks = new BehaviorSubject<Landmark[]>([]);
    constructor(private http: HttpClient) { }
  
    getSearchedLandmarksListener(): Observable<Landmark[]> {
      return this.searchedLandmarks.asObservable(); 
    }  
    searchLandmarks(keyword: string): void {      
      this.http.post<{ message: string, data: Landmark[] }>(`${SEARCH_URL}`, { keyword }).subscribe(
        result => {
          this.searchedLandmarks.next(result.data);
        },
        err => {
          console.error(err);
        }
      );
    }
  
}