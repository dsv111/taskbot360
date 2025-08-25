import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const loggedInUser = sessionStorage.getItem("loggedInUser");

    if (loggedInUser) {
      return true; // ✅ user is logged in
    }

    // ❌ not logged in → redirect to login
    this.router.navigate(['/login']);
    return false;
  }
}
