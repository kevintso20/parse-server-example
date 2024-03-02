import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { LandmarkServices } from '../landmark.service';
import { Landmark } from '../../general/landmark-card.model';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-landmarks-list',
  templateUrl: './landmarks-list.component.html',
  styleUrl: './landmarks-list.component.scss'
})
export class LandmarksListComponent implements OnInit , OnDestroy{
  private searchTerms = new Subject<string>()
  isSearching:boolean = false

  landmarks: Landmark[]
  landmarksSub: Subscription
  isLogedIn:boolean = false
  isLogedInSub:Subscription


  constructor(private landmarkServices: LandmarkServices , private authService:AuthService){}
 
  ngOnInit() {
    this.isLogedIn = this.authService.getIsAuth()
    this.isLogedInSub = this.authService.getAuthStatusListener().subscribe(result =>{
      this.isLogedIn = result

    })

    this.landmarksSub = this.landmarkServices.getLandmarksListener()
    .subscribe(results => {  
      this.landmarks = results;
    });
  }
  ngOnDestroy(): void {
    this.landmarksSub.unsubscribe()
    this.isLogedInSub.unsubscribe()
  }
  

}
