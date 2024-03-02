import { NgModule } from "@angular/core";
import { LoginComponent } from "./login/login.component";
import { AngularMaterialModule } from "../general/angular-material.module";
import { CommonModule } from "@angular/common";
import { FormsModule }   from '@angular/forms';
import { AuthRoutingModule } from "./auth-routing.module";




@NgModule({
    declarations: [
        LoginComponent,        
    ],
    imports: [
        CommonModule,
        AngularMaterialModule,
        FormsModule,
        AuthRoutingModule,

    ],
    exports: [
    ]
})

export class AuthModule{}