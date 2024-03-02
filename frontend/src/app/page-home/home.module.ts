import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MainScreenComponent } from './main-screen/main-screen.component';
import { LandmarksListComponent } from './landmarks-list/landmarks-list.component';
import { EditLandmarkComponent } from '../single-landmark/edit-landmark/edit-landmark.component';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { AngularMaterialModule } from '../general/angular-material.module';

@NgModule({
  declarations: [ 
    MainScreenComponent, 
    LandmarksListComponent,
    EditLandmarkComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    AngularMaterialModule
  ],
  exports: [
    
  ]
})
export class HomeModule { }
