import { Component, OnDestroy, OnInit } from '@angular/core';
import { GeneralServices } from '../general.service';
import { debounceTime, map } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Landmark } from '../landmark-card.model';



@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})


export class SearchBarComponent implements OnInit , OnDestroy{

  private searchTerms = new Subject<string>()
  isSearching:boolean = false

  searchedLandmarks: Landmark[]
  searchedLandmarksSub: Subscription
  
  constructor(private generalServices: GeneralServices){}

  openSearch(){
    if(this.searchedLandmarks.length > 0){
      this.isSearching = true;
    }
  }
  closeSearch() {
    this.isSearching = false;
  }
  ngOnInit() {
    this.searchTerms.pipe(debounceTime(1000)).subscribe(keyword => {  
      this.isSearching = true      
      this.generalServices.searchLandmarks(keyword);
    });
    

    this.searchedLandmarksSub = this.generalServices.getSearchedLandmarksListener()
    .subscribe(results => {  
      this.searchedLandmarks = results;
    });
  }

  ngOnDestroy(): void {
    this.searchedLandmarksSub.unsubscribe()
  }
  doSearch(keyword: string){

    if(keyword.length < 3){
      if(keyword.length == 0){
        this.closeSearch()
      }
      return
    } 

    this.searchTerms.next(keyword);
  }
}
