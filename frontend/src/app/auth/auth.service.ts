import { HttpClient } from "@angular/common/http"
import { environment } from "../../environments/environment.development";
import { AuthData } from "./auth.model";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Subject } from "rxjs";


const BACKEND_URL = environment.apiUrl + "/auth"


@Injectable({
    providedIn: 'root'
})
export class AuthService{

    constructor(public http:HttpClient , public router: Router){}

    private isAuthenticated: boolean = false
    private authStatusListener = new Subject<boolean>()
    private token: string 
    private tokenTimer: any
    private isLoadingListener = new Subject<boolean>();
    
    getIsAuth(){
        return this.isAuthenticated
    }
    getToken(){
        return this.token
    }
    getAuthStatusListener(){
        return this.authStatusListener.asObservable();
    }
    getLoadingStatusListener(){
        return this.isLoadingListener.asObservable();
    }
    autoAuthUser(){       
        const authInformation = this.getAuthData()
        if(!authInformation){
            return
        }
        const now = new Date()
        const expiration = authInformation.expiration.getTime() - now.getTime()
        if(expiration < 0){
            return
        }
        this.token = authInformation.token
        this.isAuthenticated = true
        this.logoutTimer(expiration  / 1000)
        this.authStatusListener.next(true)
    }

    getAuthData(){
        const token = localStorage.getItem("token")
        const expiration = localStorage.getItem("expiration")
        const userId = localStorage.getItem("userId")
        if(!token || !expiration){
            return
        }
        return {token: token , expiration: new Date(expiration) , userId}
    }

    login(username:string , password: string){
        const authData: AuthData = { username: username, password: password }  
        this.isLoadingListener.next(true)      
        this.http.post<{message:string , data:{token:string , expiresIn: number , userId:string}}>(`${BACKEND_URL}/login`, authData).subscribe(results => {
            this.isLoadingListener.next(false)
            if(results.data.token){
               this.isAuthenticated = true
               this.authStatusListener.next(true)
               this.token = results.data.token
               const now = new Date()
               const expiredDate = new Date(now.getTime() + results.data.expiresIn * 1000)                
               this.logoutTimer(results.data.expiresIn)              
               this.saveAuthData(results.data.token, expiredDate ,  results.data.userId)   
                            
               this.router.navigate(["/"])
            }
        }, err => {
            this.isLoadingListener.next(false)
        })
    }

    saveAuthData(token:string , expiresIn: Date , userId:  string){
        localStorage.setItem("token" , token)
        localStorage.setItem("expiration" , expiresIn.toISOString())
        localStorage.setItem("userId" , userId)
    }

    logoutTimer(expiresIn:number){
        this.tokenTimer = setTimeout(() => {
            this.clearAuthData()
        }, expiresIn * 1000 );
    }

    clearAuthData(){
        localStorage.removeItem("token")
        localStorage.removeItem("expiration")
        localStorage.removeItem("userId")
    }

    logout(){
        this.isAuthenticated = false;
        this.authStatusListener.next(false)
        this.clearAuthData()
    }

    
}