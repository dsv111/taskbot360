import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  user: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    // ✅ get logged in user from sessionStorage (not localStorage anymore)
    const storedUser = sessionStorage.getItem("loggedInUser");
    if (storedUser) {
      this.user = JSON.parse(storedUser);
    }
    console.log(this.user, "home user");
  }

  goToChat() {
    this.router.navigate(['/chat']);
  }

  logout() {
    // ✅ clear session only (do not remove users from localStorage)
    sessionStorage.removeItem("loggedInUser");
    this.user = null;
    this.router.navigate(['/login']);
  }
  login(){
    this.router.navigate(['/login']);
  }
}
