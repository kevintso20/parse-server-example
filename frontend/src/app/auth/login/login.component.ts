import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit , OnDestroy{
  
  
  constructor(public authService:AuthService){
   
  }
  isLoading:boolean = false
  isLoadingSub: Subscription


  ngOnInit(): void {
    this.isLoadingSub = this.authService.getLoadingStatusListener().subscribe(result =>{
      this.isLoading = result
    })
  }
  ngOnDestroy(): void {
    this.isLoadingSub.unsubscribe()
  }

  onLogin(form: NgForm){
    if(form.invalid){
      return ;
    }        
    this.authService.login(form.value.username , form.value.password)    
  } 

}
