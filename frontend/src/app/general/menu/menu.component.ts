import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit , OnDestroy{
  

  constructor(private authService:AuthService){}

  isLogedIn:boolean = false
  isLogedInSub:Subscription
  ngOnInit(): void {
    this.isLogedIn = this.authService.getIsAuth()   
    this.isLogedInSub = this.authService.getAuthStatusListener().subscribe(result =>{
      this.isLogedIn = result      
    })
  }  
  ngOnDestroy(): void {
    this.isLogedInSub.unsubscribe()
  }
  logout(){
    this.authService.logout()
  }


}
