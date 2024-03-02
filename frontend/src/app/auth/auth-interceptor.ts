import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest } from '@angular/common/http';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const authToken = this.authService.getToken();
    const authRequest = req.clone({
      headers: new HttpHeaders().set('authorization', 'Bearer ' + authToken)
    });
    return next.handle(authRequest);
    //return next.handle(req)
  }
  
}

