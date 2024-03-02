import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Landmark } from '../../general/landmark-card.model';
import { LandmarkServices } from '../../page-home/landmark.service';


@Component({
  selector: 'app-edit-landmark',
  templateUrl: './edit-landmark.component.html',
  styleUrl: './edit-landmark.component.scss'
})
export class EditLandmarkComponent implements OnInit , OnDestroy{

  form:FormGroup
  landmark: Landmark[]
  landmarkListenerSub: Subscription
  landmarkUpdateSubscription: Subscription;
  isLoading:boolean = false
  isLoadingSub: Subscription
  
  constructor(private landmarkService:LandmarkServices){
    this.landmarkService.getLandmark()
  }

  ngOnInit(): void {      
    this.form = new FormGroup({
      title: new FormControl(null, { validators: [Validators.required] }),
      shortinfo: new FormControl(null, { validators: [Validators.required] }),
      description: new FormControl(null, { validators: [Validators.required] }),       
    });
  
    this.landmarkListenerSub = this.landmarkService.getLandmarkListener().subscribe(landmark => {
      this.landmark = landmark
      if (this.landmark.length > 0) {
        this.form.setValue({
          title: this.landmark[0].title,
          shortinfo: this.landmark[0].short_info,
          description: this.landmark[0].description,
        });
      }
    });
  }

  

  ngOnDestroy(): void {
    this.landmarkListenerSub.unsubscribe()    
    if (this.landmarkUpdateSubscription) {
      this.landmarkUpdateSubscription.unsubscribe();
    }
  }

  onSave(){
    this.isLoading = true
    this.landmarkUpdateSubscription = this.landmarkService.updateLandmark(
      this.landmark[0]._id,
      this.form.value.title,
      this.form.value.shortinfo,
      this.form.value.description 
    ).subscribe(
      result => {
        this.isLoading = false
        console.log("Landmark updated successfully:", result);
      },
      error => {
        console.error("Error updating landmark:", error);
      }
    );
  }
  
}

