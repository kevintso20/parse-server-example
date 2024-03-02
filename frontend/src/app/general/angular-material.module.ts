import { NgModule } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';


@NgModule({  
    exports:[
        MatToolbarModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatSelectModule
    ],
    imports:[
        
    ]
})
export class AngularMaterialModule{}