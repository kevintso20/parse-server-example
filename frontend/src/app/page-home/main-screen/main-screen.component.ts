import { Component, Input } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-screen',
  templateUrl: './main-screen.component.html',
  styleUrl: './main-screen.component.scss'
})


export class MainScreenComponent {
   @Input() classes: string;

   private appointmentsSub: Subscription
   totalAppointment: number = 0

   constructor(){}

   ngOnInit() {
     
   }

   ngOnDestroy() {
     
   }
   

}
