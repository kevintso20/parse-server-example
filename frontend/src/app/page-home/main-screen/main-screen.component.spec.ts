import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainScreenComponent } from './main-screen.component';
import { HttpClientModule } from '@angular/common/http';
import { GoodEveningBannerComponent } from '../good-evening-banner/good-evening-banner.component';
import { TotalApoimentsBannerComponent } from '../total-apoiments-banner/total-apoiments-banner.component';
import { DoctorsListComponent } from '../../page-doctor/doctors-list/doctors-list.component';

describe('MainScreenComponent', () => {
  let component: MainScreenComponent;
  let fixture: ComponentFixture<MainScreenComponent>;
 
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        MainScreenComponent ,
        GoodEveningBannerComponent,
        TotalApoimentsBannerComponent,
        DoctorsListComponent
      ],
      imports:[HttpClientModule]
    })
    .compileComponents();
     
    fixture = TestBed.createComponent(MainScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
