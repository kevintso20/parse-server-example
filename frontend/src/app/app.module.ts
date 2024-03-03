import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { MenuComponent } from './general/menu/menu.component';
import { AppRoutingModule } from './app.routing.module';
import { HomeModule } from './page-home/home.module';
import { SearchBarComponent } from './general/search-bar/search-bar.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { AuthInterceptor } from './auth/auth-interceptor';


@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    SearchBarComponent

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HomeModule,
    HttpClientModule,
    MatDialogModule,

  ],
  providers: [
    { provide:HTTP_INTERCEPTORS, useClass: AuthInterceptor , multi:true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
