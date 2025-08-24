import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  user: any;
constructor(private router: Router) {}
ngOnInit() {
    this.user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    console.log(this.user,"home user");
    

}

  goToChat() {
    this.router.navigate(['/chat']);
  }
}
