import { Component, OnDestroy, OnInit } from '@angular/core';
import { LandmarkServices } from '../../page-home/landmark.service';
import { Subscription } from 'rxjs';
import { Landmark } from '../../general/landmark-card.model';



@Component({
  selector: 'app-single-page',
  templateUrl: './single-page.component.html',
  styleUrl: './single-page.component.scss'
})
export class SinglePageComponent implements OnInit , OnDestroy{

  landmark: Landmark[]
  landmarkListenerSub: Subscription 


  constructor(private landmarkService:LandmarkServices ){
    this.landmarkService.getLandmark()
  }

  ngOnInit(): void {
   
    this.landmarkListenerSub = this.landmarkService.getLandmarkListener().subscribe(landmark => {
      this.landmark = landmark
    })
  }
  ngOnDestroy(): void {
    this.landmarkListenerSub.unsubscribe()
  }

}
