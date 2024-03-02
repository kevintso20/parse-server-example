import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Routes } from "@angular/router";

import { MainScreenComponent } from "./page-home/main-screen/main-screen.component";
import { SinglePageComponent } from "./single-landmark/single-page/single-page.component";
import { EditLandmarkComponent } from "./single-landmark/edit-landmark/edit-landmark.component";
import { AuthGuard } from "./auth/auth.guard";




const routes: Routes = [
    { path: "" , component: MainScreenComponent ,  },  
    { path: "landmark/:id" , component:SinglePageComponent },
    { path: "landmark/edit/:id" , component:EditLandmarkComponent , canActivate:[AuthGuard] },
    { path: "auth" , loadChildren: () => import("./auth/auth.module").then(m => m.AuthModule)},
]

@NgModule({    
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    providers: [AuthGuard]
})



export class AppRoutingModule{}